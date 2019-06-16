const functions = require("firebase-functions");
const admin = require("firebase-admin");
const sendgrid = require("@sendgrid/mail");
const cors = require("cors")({ origin: true });

admin.initializeApp();
sendgrid.setApiKey(functions.config().sendgrid.apikey);

exports.submitTalk = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    const submissionParams = [
      "description",
      "email",
      "language",
      "name",
      "title"
    ];
    const validLanguages = ["pl", "en"];

    let submission = {};
    let errors = [];

    // Presence validation
    submissionParams.forEach(param => {
      if (req.body[param]) {
        submission[param] = req.body[param];
      } else {
        errors.push({ code: "missingParam", field: param });
      }
    });

    // Language validation
    if (submission.language && !validLanguages.includes(submission.language)) {
      errors.push({ code: "incorrectLanguage", field: "language" });
    }

    // Email validation
    if (submission.email && !/.+@.+\..+/.test(submission.email)) {
      errors.push({ code: "invalidEmail", field: "email" });
    }

    submission.verified = false;
    submission.date = admin.database.ServerValue.TIMESTAMP;

    if (errors.length) {
      res.status(400).send({ errors: errors });
    } else {
      await admin
        .database()
        .ref("/submissions")
        .push(submission);
      res.status(201).end();
    }
  });
});

exports.sendVerification = functions.database
  .ref("/submissions/{submissionId}")
  .onCreate((snapshot, context) => {
    const {
      sendgrid: { templateid: templateId },
      submissions: { verifyurl: verifyUrl }
    } = functions.config();
    const submission = snapshot.val();
    const { submissionId } = context.params;

    const message = {
      to: {
        name: submission.name,
        email: submission.email
      },
      from: {
        name: "warsaw.ex",
        email: "hello@warsawex.org"
      },
      templateId: templateId,
      dynamic_template_data: {
        speakerName: submission.name,
        talkTitle: submission.title,
        talkDescription: submission.description,
        talkLanguage: submission.language,
        confirmationUrl: verifyUrl + "?t=" + submissionId
      }
    };

    return sendgrid.send(message);
  });

exports.verifyTalk = functions.https.onRequest(async (req, res) => {
  const { t } = req.query;
  const {
    submissions: { postverifyurl: postVerifyUrl }
  } = functions.config();

  await admin
    .database()
    .ref(`/submissions/${t}`)
    .update({ verified: true });

  res.redirect(postVerifyUrl);
});

exports.promoteSubmission = functions.database
  .ref("/submissions/{submissionId}")
  .onUpdate((change, context) => {
    const before = change.before.val();
    const after = change.after.val();

    if (before.verified === after.verified) return null;

    const { submissionId } = context.params;

    if (after.verified) {
      return admin
        .database()
        .ref("/talks")
        .push(after)
        .then(() => {
          return admin
            .database()
            .ref(`/submissions/${submissionId}`)
            .remove();
        });
    }

    return null;
  });

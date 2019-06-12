const functions = require("firebase-functions");
const admin = require("firebase-admin");
const sendgrid = require("@sendgrid/mail");

admin.initializeApp();
sendgrid.setApiKey(functions.config().sendgrid.apikey);

exports.submitTalk = functions.https.onRequest(async (req, res) => {
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

exports.sendVerification = functions.database
  .ref("/submissions/{submissionId}")
  .onCreate((snapshot, context) => {
    const templateId = functions.config().sendgrid.templateid;
    const submission = snapshot.val();

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
        confirmationUrl: "https://www.google.com"
      }
    };

    return sendgrid.send(message);
  });

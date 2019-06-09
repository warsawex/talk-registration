const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.submitTalk = functions.https.onRequest(async (req, res) => {
  const submissionParams = ["description", "email", "language", "name", "title"];
  const validLanguages = ["pl", "en"];

  let submission = {};
  let errors = [];

  // Presence validation
  submissionParams.forEach(param => {
    if(req.body[param]) {
      submission[param] = req.body[param];
    } else {
      errors.push({ code: "missingParam", field: param });
    }
  });

  // Language validation
  if(submission.language && !validLanguages.includes(submission.language)) {
    errors.push({ code: "incorrectLanguage", field: "language" });
  }

  // Email validation
  if(submission.email && !/.+@.+\..+/.test(submission.email)) {
    errors.push({ code: "invalidEmail", field: "email" });
  }

  submission.verified = false;
  submission.date = admin.database.ServerValue.TIMESTAMP;

  if(errors.length) {
    res.status(400).send({ errors: errors });
  } else {
    await admin.database().ref('/submissions').push(submission);
    res.status(201).end();
  }
});

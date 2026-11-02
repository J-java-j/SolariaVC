// The words a signer agrees to. Every consent and signature records the version
// and SHA-256 of the exact text shown, so never edit a published version: add a
// new one and bump DISCLOSURE_VERSION, leaving the old wording in git history.
// Certificates print the wording in this file, so let documents out for signature
// finish first, or teach the certificate to print the version each signer accepted.
//
// This covers the items 15 U.S.C. § 7001(c)(1) requires before a consumer agrees
// to electronic records: the right to paper, the right to withdraw and its
// consequences, the scope of the consent, how to withdraw and update contact
// details, how to get a paper copy and any fee, and hardware and software needs.
// It is its own step, separate from the document and optional, because Cal. Civ.
// Code § 1633.5(b) restricts burying this agreement in a standard form contract.
import { createHash } from 'node:crypto';
import { ORG } from './config.js';

export const DISCLOSURE_VERSION = '2026-10-31';

export const DISCLOSURE = {
  version: DISCLOSURE_VERSION,
  title: 'Consent to electronic records and signatures',
  intro:
    `${ORG.legalName} ("Solaria") would like to give you this document and obtain your signature ` +
    'electronically. This step is separate from the document itself and it is optional. ' +
    'Please read it before you continue.',
  sections: [
    {
      heading: 'What you are agreeing to',
      body:
        'If you agree, you will review and sign this document online. Your electronic signature will ' +
        'have the same effect as a handwritten signature. Solaria will give you the records for this ' +
        'transaction electronically: the signed document, its certificate of completion, and any ' +
        'related notices.',
    },
    {
      heading: 'What this consent covers',
      body:
        'This consent applies only to this document and the transaction it relates to. It does not ' +
        'cover any other document or any future transaction.',
    },
    {
      heading: 'You can have it on paper instead',
      body:
        'You do not have to sign electronically. You have the right to receive this document on paper ' +
        `and sign it by hand. Choose "I need paper instead" on this page, or email ${ORG.contactEmail}. ` +
        'There is no fee.',
    },
    {
      heading: 'You can withdraw this consent',
      body:
        `You can withdraw this consent at any time by emailing ${ORG.contactEmail}, or before you finish ` +
        'signing by choosing "Decline". There is no fee or penalty. If you withdraw before you finish, ' +
        'this document will not be completed electronically and Solaria will arrange a paper process ' +
        'with you. If you withdraw after you finish, Solaria will give you any later records for this ' +
        'transaction on paper. Withdrawal takes effect within a reasonable time after Solaria receives ' +
        'it and does not affect anything already signed or provided electronically.',
    },
    {
      heading: 'Getting a paper copy later',
      body:
        `After signing you can ask for a paper copy of any electronic record by emailing ${ORG.contactEmail} ` +
        'with the document title or reference number shown on it. There is no fee.',
    },
    {
      heading: 'Keeping your contact details current',
      body: `To change the email address Solaria uses to reach you, email ${ORG.contactEmail}.`,
    },
    {
      heading: 'What you need',
      body:
        'To open and keep these records you need a device with internet access; a current version of ' +
        'Chrome, Safari, Edge or Firefox with JavaScript turned on; software that opens PDF files, such ' +
        'as the viewer built into most browsers and phones or Adobe Acrobat Reader; an email account ' +
        'you can access; and storage space or a printer to keep your copy. If these needs change in a ' +
        'way that could stop you opening or keeping your records, Solaria will tell you, and you may ' +
        'withdraw this consent at no cost.',
    },
  ],
  agreement:
    'I can read this disclosure and the document preview on this device, I can keep a copy, and I agree ' +
    'to use electronic records and signatures for this document.',
};

export const INTENT_VERSION = '2026-10-30';

export const INTENT = {
  version: INTENT_VERSION,
  adopt:
    'By selecting Adopt and sign, I agree that this mark is my electronic signature and that I intend ' +
    'to sign with it wherever I place it on this document, with the same legal effect as my handwritten ' +
    'signature.',
  finish:
    'I have reviewed this document. By selecting Finish and sign, I intend to sign it electronically ' +
    'and to be legally bound by it. If I am signing for a company or another person, I confirm that I ' +
    'have the authority to do so.',
};

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

export const DISCLOSURE_SHA256 = sha256(JSON.stringify(DISCLOSURE));
export const INTENT_SHA256 = sha256(JSON.stringify(INTENT));

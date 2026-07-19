const webLegal = require("../../src/legalDocuments");

const LEGAL_CONSENT_KEY = "dream_anatomy_guest_legal_consent_v1";

function getLegalVersions() {
  return {
    privacyPolicyVersion: webLegal.PRIVACY_POLICY_VERSION,
    termsVersion: webLegal.TERMS_VERSION,
    aiDisclaimerVersion: webLegal.AI_DISCLAIMER_VERSION
  };
}

function getLegalDocument(type) {
  return webLegal.getLegalDocument(type);
}

function readConsent(wxRef) {
  try {
    const value = wxRef.getStorageSync(LEGAL_CONSENT_KEY);
    return value && typeof value === "object" ? value : null;
  } catch (error) {
    return null;
  }
}

function hasAcceptedLegalVersions(wxRef) {
  const consent = readConsent(wxRef);
  const versions = getLegalVersions();
  return Boolean(
    consent
      && consent.privacyPolicyVersion === versions.privacyPolicyVersion
      && consent.termsVersion === versions.termsVersion
      && consent.aiDisclaimerVersion === versions.aiDisclaimerVersion
  );
}

function saveGuestLegalConsent(wxRef) {
  const consent = {
    ...getLegalVersions(),
    acceptedAt: new Date().toISOString()
  };
  wxRef.setStorageSync(LEGAL_CONSENT_KEY, consent);
  return consent;
}

module.exports = {
  LEGAL_CONSENT_KEY,
  getLegalDocument,
  getLegalVersions,
  hasAcceptedLegalVersions,
  saveGuestLegalConsent
};

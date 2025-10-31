const DEFAULT_MAIL_SUBJECT = 'EasyAccomodation Inquiry';

export const buildMailto = (email, subject = DEFAULT_MAIL_SUBJECT) => {
  if (!email) return '#';
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
};

export const MAILTO_SUBJECTS = {
  default: DEFAULT_MAIL_SUBJECT,
  support: 'EasyAccomodation Support Request',
  booking: 'EasyAccomodation Booking Query',
  owner: 'EasyAccomodation House Inquiry',
};

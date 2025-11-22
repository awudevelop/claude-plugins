function formatDate(date) {
  return date.toISOString();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function slugify(text) {
  return text.toLowerCase().replace(/\s+/g, '-');
}

module.exports = {
  formatDate,
  validateEmail,
  slugify
};

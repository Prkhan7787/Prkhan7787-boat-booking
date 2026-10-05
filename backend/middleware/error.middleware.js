function notFound(req, res) {
  res.status(404).json({ success: false, message: 'The requested resource was not found.' });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  console.error(error);
  const databaseErrors = {
    '23503': [409, 'This record is still in use and cannot be removed.'],
    '23505': [409, 'A record with that value already exists.'],
    '23514': [400, 'Some of the provided values are not allowed.']
  };
  const mapped = databaseErrors[error.code];
  const status = error.status || mapped?.[0] || 500;
  const message = error.status ? error.message : mapped?.[1] || 'Something went wrong. Please try again.';
  res.status(status).json({ success: false, message });
}

module.exports = { notFound, errorHandler };

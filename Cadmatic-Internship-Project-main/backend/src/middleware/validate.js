const Joi = require('joi');

const validate = (schema) => (req, res, next) => {
  const data = {
    ...(schema.params ? { params: req.params } : {}),
    ...(schema.query ? { query: req.query } : {}),
    ...(schema.body ? { body: req.body } : {}),
  };

  const options = { abortEarly: false, allowUnknown: false, stripUnknown: true };
  const { error, value } = Joi.object(schema).validate(data, options);

  if (error) {
    const message = error.details.map((detail) => detail.message.replace(/"/g, '')).join(', ');
    return res.status(400).json({ success: false, message });
  }

  if (schema.params) req.params = value.params;
  if (schema.query) req.query = value.query;
  if (schema.body) req.body = value.body;
  next();
};

module.exports = validate;

const Joi = require('joi');

const loginSchema = {
  body: Joi.object({
    username: Joi.string().trim().required(),
    password: Joi.string().required(),
  }),
};

const createUserSchema = {
  body: Joi.object({
    username: Joi.string().trim().required(),
    full_name: Joi.string().trim().required(),
    email: Joi.string().trim().email().optional().allow('', null),
    password: Joi.string().required(),
    role: Joi.string().valid('Admin', 'Viewer').required(),
    status: Joi.string().valid('Active', 'Inactive').optional(),
  }),
};

const updateUserSchema = {
  body: Joi.object({
    full_name: Joi.string().trim().optional(),
    email: Joi.string().trim().email().optional().allow('', null),
    password: Joi.string().optional(),
    role: Joi.string().valid('Admin', 'Viewer').optional(),
    status: Joi.string().valid('Active', 'Inactive').optional(),
  }),
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
};

module.exports = { loginSchema, createUserSchema, updateUserSchema };

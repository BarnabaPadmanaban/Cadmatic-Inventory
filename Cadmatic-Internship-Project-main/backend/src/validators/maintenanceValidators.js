const Joi = require('joi');

const createMaintenanceSchema = {
  body: Joi.object({
    equipment_id: Joi.number().integer().positive().required(),
    maintenance_date: Joi.date().required(),
    description: Joi.string().trim().required(),
    performed_by: Joi.string().trim().optional().allow('', null),
    next_due_date: Joi.date().optional().allow('', null),
  }),
};

const updateMaintenanceSchema = {
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
  body: Joi.object({
    maintenance_date: Joi.date().optional(),
    description: Joi.string().trim().optional(),
    performed_by: Joi.string().trim().optional().allow('', null),
    next_due_date: Joi.date().optional().allow('', null),
  }),
};

const uploadDocumentSchema = {
  params: Joi.object({
    maintenance_id: Joi.number().integer().positive().required(),
  }),
};

module.exports = { createMaintenanceSchema, updateMaintenanceSchema, uploadDocumentSchema };

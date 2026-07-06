const Joi = require('joi');

const createEquipmentSchema = {
  body: Joi.object({
    position_id: Joi.string().trim().required(),
    storage_number: Joi.string().trim().optional().allow('', null),
    epc_po_number: Joi.string().trim().optional().allow('', null),
    sub_po_number: Joi.string().trim().optional().allow('', null),
    sub_po_vendor: Joi.string().trim().optional().allow('', null),
    equipment_status_code: Joi.number().integer().min(0).max(8).required(),
    npcil_spec_number: Joi.string().trim().optional().allow('', null),
    npcil_spec_status: Joi.string().trim().optional().allow('', null),
    drawing_number: Joi.string().trim().optional().allow('', null),
    drawing_status: Joi.string().trim().optional().allow('', null),
    data_sheet_number: Joi.string().trim().optional().allow('', null),
    data_sheet_status: Joi.string().trim().optional().allow('', null),
    as_built_drawing_number: Joi.string().trim().optional().allow('', null),
    epc_package_name: Joi.string().trim().optional().allow('', null),
    equip_status: Joi.string().trim().optional().allow('', null),
    location: Joi.string().trim().optional().allow('', null),
    equipment_type: Joi.string().trim().optional().allow('', null),
    last_inspection_date: Joi.date().optional().allow('', null),
    next_inspection_date: Joi.date().optional().allow('', null),
  }),
};

const idParamSchema = {
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
};

const updateEquipmentSchema = {
  ...createEquipmentSchema,
  params: idParamSchema.params,
};

module.exports = { createEquipmentSchema, updateEquipmentSchema, idParamSchema };

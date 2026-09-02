import Joi from 'joi';

export const messageSchema = Joi.object({
  chatId: Joi.string().required(),
  content: Joi.string().when('messageType', {
    is: 'text',
    then: Joi.string().required().min(1),
    otherwise: Joi.string().allow(''),
  }),
  messageType: Joi.string().valid('text', 'image', 'file', 'voice').default('text'),
  replyTo: Joi.string().allow(null),
});

export const chatSchema = Joi.object({
  participants: Joi.array().items(Joi.string()).required(),
  name: Joi.string().when('type', {
    is: 'group',
    then: Joi.string().required().min(3),
    otherwise: Joi.string().allow(null),
  }),
  type: Joi.string().valid('private', 'group').default('private'),
});
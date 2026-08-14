'use strict';

const articleSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['articleType', 'title', 'description', 'audience', 'dek', 'verdict', 'visualBrief', 'sections', 'takeaways', 'faq', 'sources', 'affiliateDisclosure'],
  properties: {
    articleType: { type: 'string', enum: ['evergreen-guide', 'comparison', 'current-deals'] },
    title: { type: 'string', minLength: 20, maxLength: 80 },
    description: { type: 'string', minLength: 80, maxLength: 170 },
    audience: { type: 'string', minLength: 15, maxLength: 180 },
    dek: { type: 'string', minLength: 40, maxLength: 260 },
    verdict: {
      type: 'object', additionalProperties: false, required: ['bottomLine', 'bestFor', 'skipIf'],
      properties: {
        bottomLine: { type: 'string', minLength: 40, maxLength: 320 },
        bestFor: { type: 'string', minLength: 20, maxLength: 220 },
        skipIf: { type: 'string', minLength: 20, maxLength: 220 }
      }
    },
    visualBrief: {
      type: 'object', additionalProperties: false, required: ['concept', 'alt', 'caption'],
      properties: {
        concept: { type: 'string', minLength: 30, maxLength: 400 },
        alt: { type: 'string', minLength: 20, maxLength: 180 },
        caption: { type: 'string', minLength: 20, maxLength: 220 }
      }
    },
    sections: {
      type: 'array', minItems: 3, maxItems: 8,
      items: {
        type: 'object', additionalProperties: false, required: ['heading', 'body', 'recommendation'],
        properties: {
          heading: { type: 'string', minLength: 5, maxLength: 90 },
          body: { type: 'string', minLength: 120, maxLength: 1400 },
          recommendation: { type: 'string', minLength: 20, maxLength: 320 }
        }
      }
    },
    takeaways: { type: 'array', minItems: 3, maxItems: 7, items: { type: 'string', minLength: 15, maxLength: 220 } },
    faq: {
      type: 'array', minItems: 2, maxItems: 5,
      items: {
        type: 'object', additionalProperties: false, required: ['question', 'answer'],
        properties: {
          question: { type: 'string', minLength: 10, maxLength: 140 },
          answer: { type: 'string', minLength: 40, maxLength: 500 }
        }
      }
    },
    sources: {
      type: 'array', minItems: 2, maxItems: 10,
      items: {
        type: 'object', additionalProperties: false, required: ['title', 'url', 'supports'],
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 160 },
          url: { type: 'string', minLength: 12, maxLength: 500 },
          supports: { type: 'string', minLength: 10, maxLength: 240 }
        }
      }
    },
    affiliateDisclosure: { type: 'string', minLength: 40, maxLength: 260 }
  }
};

module.exports = { articleSchema };

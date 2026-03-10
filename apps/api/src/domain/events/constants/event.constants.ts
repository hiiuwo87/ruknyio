/**
 * Events Module Constants
 * Security and validation constants
 */

export const EVENT_CONSTANTS = {
  // Slug configuration
  SLUG: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 10,
    DEFAULT_LENGTH: 6,
    PATTERN: /^[a-z0-9]+$/,
  },

  // Rate limiting
  RATE_LIMIT: {
    CREATE_EVENT: {
      LIMIT: 5,
      TTL: 60000, // 1 minute
    },
    REGISTER: {
      LIMIT: 10,
      TTL: 60000, // 1 minute
    },
    REVIEW: {
      LIMIT: 3,
      TTL: 60000, // 1 minute
    },
  },

  // Validation limits
  LIMITS: {
    TITLE_MAX: 200,
    DESCRIPTION_MAX: 5000,
    VENUE_MAX: 200,
    LOCATION_MAX: 500,
    COMMENT_MAX: 2000,
    NOTES_MAX: 1000,
    MIN_ATTENDEES: 1,
    MAX_PRICE: 999999,
    REQUEST_SIZE_MAX: 1024 * 1024, // 1MB
  },

  // Review settings
  REVIEW: {
    MIN_RATING: 1,
    MAX_RATING: 5,
    REVIEWS_PER_PAGE: 10,
  },

  // Registration settings
  REGISTRATION: {
    WAITLIST_EXPIRY_HOURS: 24,
  },

  // URL patterns
  URL_PATTERNS: {
    SHORT_URL_PREFIX: '/e/',
    MEETING_URL_PROTOCOLS: ['http:', 'https:'],
  },
};

/**
 * Event error messages
 */
export const EVENT_ERRORS = {
  SLUG_EXISTS: 'Event slug already exists',
  SLUG_INVALID: 'Invalid slug format',
  SLUG_GENERATION_FAILED: 'Unable to generate unique slug',
  EVENT_NOT_FOUND: 'Event not found',
  UNAUTHORIZED: 'You can only modify your own events',
  INVALID_DATES: 'End date must be after start date',
  PAST_START_DATE: 'Start date cannot be in the past',
  INVALID_URL:
    'Invalid URL format - must be a valid http/https URL or start with /',
  NEGATIVE_PRICE: 'Price cannot be negative',
  INVALID_ATTENDEES: 'Maximum attendees must be at least 1',
  ALREADY_REGISTERED: 'You are already registered for this event',
  ALREADY_REVIEWED: 'You have already reviewed this event',
  NOT_ATTENDED: 'You can only review events you attended',
  EVENT_CLOSED: 'Event is not open for registration',
  PAYLOAD_TOO_LARGE: 'Request payload too large',
  INVALID_CONTENT_TYPE: 'Content-Type must be application/json',
};

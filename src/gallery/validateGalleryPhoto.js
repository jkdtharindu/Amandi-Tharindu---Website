export function validateGalleryPhoto({ photoUrl, caption = '', displayOrder = 0 }) {
  const errors = {};

  if (!photoUrl || typeof photoUrl !== 'string' || !photoUrl.trim()) {
    errors.photoUrl = 'Photo URL is required';
  } else if (photoUrl.trim().length > 2000) {
    errors.photoUrl = 'Photo URL is too long';
  }

  if (typeof caption !== 'string') {
    errors.caption = 'Caption must be text';
  } else if (caption.trim().length > 500) {
    errors.caption = 'Caption is too long (max 500 characters)';
  }

  if (!Number.isInteger(displayOrder) || displayOrder < 0) {
    errors.displayOrder = 'Display order must be a non-negative integer';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function sanitizeGalleryPhoto({ photoUrl = '', caption = '', displayOrder = 0 }) {
  return {
    photoUrl: (photoUrl || '').trim(),
    caption: (caption || '').trim(),
    displayOrder: Number.isInteger(displayOrder) ? displayOrder : 0,
  };
}

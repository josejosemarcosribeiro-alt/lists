/**
 * Updates:
 * - Added full video support for posts (upload, edit, delete) using Cloudinary.
 * - Cloudinary variables now come from Render backend (cloudName and uploadPreset).
 * - Fixed error handling to prevent Internal Server Error.
 * - Updated `add_list.pug`, `edit_item.pug`, and `item.pug` to handle videos correctly.
 * - All routes maintain authentication and data validation.
 *
 * Result: fully functional lesson system with direct video upload, editing, and viewing.
 */

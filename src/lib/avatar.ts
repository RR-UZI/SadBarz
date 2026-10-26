// Profile photo: picked from the gallery, cut to a square and shrunk, so it
// can be saved with the rest of the user's data and shown on every device.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const AVATAR_PX = 256;

// A small JPEG data URL, or null when the user closed the picker.
export async function pickAvatar(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  const asset = res.canceled ? null : res.assets[0];
  if (!asset) return null;
  const { uri, width, height } = asset;
  let ctx = ImageManipulator.manipulate(uri);
  // The web picker has no crop step, so take the middle square.
  if (width && height && width !== height) {
    const side = Math.min(width, height);
    ctx = ctx.crop({ originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side });
  }
  const image = await ctx.resize({ width: AVATAR_PX, height: AVATAR_PX }).renderAsync();
  const out = await image.saveAsync({ base64: true, compress: 0.7, format: SaveFormat.JPEG });
  return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
}

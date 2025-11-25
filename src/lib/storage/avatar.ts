import fs from 'node:fs/promises';
import path from 'node:path';

import { deleteStoredFile, saveBase64File } from './local';

const LEGACY_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'avatars');

export { isBase64DataUri } from './local';

export async function saveAvatarToLocal(base64Data: string): Promise<string> {
	return saveBase64File(base64Data, 'avatars', 'avatar');
}

export async function deleteAvatarAsset(avatarUrl: string): Promise<void> {
	if (!avatarUrl) return;
	await deleteStoredFile(avatarUrl);
	await deleteLegacyAvatarIfExists(avatarUrl);
}

export async function deleteLegacyAvatarIfExists(avatarUrl: string): Promise<void> {
	if (!avatarUrl || !avatarUrl.startsWith('/uploads/avatars/')) return;
	try {
		const filename = path.basename(avatarUrl);
		const filepath = path.join(LEGACY_UPLOAD_DIR, filename);
		await fs.unlink(filepath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
			console.error('删除旧版本地头像失败', error);
		}
	}
}

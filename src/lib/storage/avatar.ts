import { put, del } from '@vercel/blob';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'avatars');

function ensureToken(): string {
	const token = process.env.BLOB_READ_WRITE_TOKEN;
	if (!token) {
		throw new Error('BLOB_READ_WRITE_TOKEN 未配置，请在环境变量中设置');
	}
	return token;
}

type DecodedImage = {
	buffer: Buffer;
	contentType: string;
	extension: string;
};

function decodeBase64Image(base64Data: string): DecodedImage {
	const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
	const extension = matches ? matches[1] : 'png';
	const pureBase64 = matches ? matches[2] : base64Data;
	const buffer = Buffer.from(pureBase64, 'base64');
	return {
		buffer,
		contentType: `image/${extension}`,
		extension,
	};
}

export function isBase64DataUri(str: string | null | undefined): boolean {
	if (!str) return false;
	return str.startsWith('data:image/');
}

export async function uploadAvatarToBlob(base64Data: string): Promise<string> {
	const token = ensureToken();
	const { buffer, contentType, extension } = decodeBase64Image(base64Data);
	const key = `avatars/${randomUUID()}.${extension}`;
	const { url } = await put(key, buffer, {
		access: 'public',
		token,
		contentType,
	});
	return url;
}

export async function deleteAvatarFromBlob(avatarUrl: string): Promise<void> {
	if (!avatarUrl) return;
	const token = process.env.BLOB_READ_WRITE_TOKEN;
	if (!token) return;
	try {
		await del(avatarUrl, { token });
	} catch (error) {
		console.error('删除 Blob 头像失败', error);
	}
}

export async function deleteLocalAvatarIfExists(avatarUrl: string): Promise<void> {
	if (!avatarUrl || !avatarUrl.startsWith('/uploads/avatars/')) return;
	try {
		const filename = path.basename(avatarUrl);
		const filepath = path.join(LOCAL_UPLOAD_DIR, filename);
		await fs.unlink(filepath);
	} catch (error) {
		console.error('删除本地头像失败', error);
	}
}

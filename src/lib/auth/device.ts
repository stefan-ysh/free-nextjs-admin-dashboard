import crypto from 'crypto';

export type DeviceType = 'mobile' | 'desktop';

export function detectDeviceType(userAgent: string | null | undefined): DeviceType {
  if (!userAgent) return 'desktop';
  const ua = userAgent.toLowerCase();
  const mobileIndicators = ['iphone', 'android', 'mobile', 'ipad', 'ipod', 'blackberry'];
  return mobileIndicators.some((indicator) => ua.includes(indicator)) ? 'mobile' : 'desktop';
}

export function hashUserAgent(userAgent: string | null | undefined): string {
  return crypto.createHash('sha256').update(userAgent || 'unknown').digest('hex');
}

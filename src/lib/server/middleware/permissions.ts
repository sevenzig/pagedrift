import type { AuthUser } from '../auth';

export function hasPermission(
	user: AuthUser | null,
	permission: 'upload' | 'delete' | 'admin'
): boolean {
	if (!user) {
		return false;
	}

	// Admins have all permissions
	if (user.role === 'admin') {
		return true;
	}

	switch (permission) {
		case 'upload':
			return user.canUpload;
		case 'delete':
			return user.canDelete;
		case 'admin':
			return false;
		default:
			return false;
	}
}

export function requirePermission(
	user: AuthUser | null,
	permission: 'upload' | 'delete' | 'admin'
): void {
	if (!hasPermission(user, permission)) {
		throw new Error(`Forbidden: ${permission} permission required`);
	}
}


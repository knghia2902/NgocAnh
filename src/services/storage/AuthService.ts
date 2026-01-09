import { dbContext } from './DBContext';

export interface User {
    username: string;
    role: 'admin';
}

const STORAGE_KEYS = {
    CREDENTIALS: 'auth_credentials',
    IS_FIRST_LOGIN: 'auth_is_first_login'
};

export class AuthService {
    // Default credentials (mock)
    private defaultCreds = {
        username: 'admin',
        password: '123' // Simple pass for demo, user will change it
    };

    /**
     * Initialize Auth (Check if credentials exist, if not set default)
     */
    async init() {
        const creds = await dbContext.get(STORAGE_KEYS.CREDENTIALS);
        if (!creds) {
            await dbContext.set(STORAGE_KEYS.CREDENTIALS, this.defaultCreds);
            await dbContext.set(STORAGE_KEYS.IS_FIRST_LOGIN, true);
        }
    }

    async login(username: string, password: string): Promise<{ success: boolean; isFirstLogin?: boolean }> {
        await this.init(); // Ensure init

        const creds: any = await dbContext.get(STORAGE_KEYS.CREDENTIALS);
        const isFirst: boolean = await dbContext.get(STORAGE_KEYS.IS_FIRST_LOGIN) || false;

        if (username === creds.username && password === creds.password) {
            return { success: true, isFirstLogin: isFirst };
        }
        return { success: false };
    }

    async changePassword(newPassword: string): Promise<boolean> {
        const creds: any = await dbContext.get(STORAGE_KEYS.CREDENTIALS);
        if (creds) {
            creds.password = newPassword;
            await dbContext.set(STORAGE_KEYS.CREDENTIALS, creds);
            await dbContext.set(STORAGE_KEYS.IS_FIRST_LOGIN, false); // No longer first login
            return true;
        }
        return false;
    }

    async isAuthenticated(): Promise<boolean> {
        // In a real app, check session token. Here we check simple local state or session storage if needed.
        // For simplicity in this demo, we rely on the Pinia store state persistence,
        // but this method can verify against DB/Token if we expand.
        return true;
    }
}

export const authService = new AuthService();

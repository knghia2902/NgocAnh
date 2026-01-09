import { reactive, watch } from 'vue';
import { authService } from '../services/storage/AuthService';

interface AuthState {
    isAuthenticated: boolean;
    user: string | null;
    isFirstLogin: boolean;
}

const STORAGE_KEY = 'auth_session';

const savedState = localStorage.getItem(STORAGE_KEY);
const initialState: AuthState = savedState ? JSON.parse(savedState) : {
    isAuthenticated: false,
    user: null,
    isFirstLogin: false
};

export const authStore = reactive<AuthState>(initialState);

// Persistence for Session (keep login on refresh)
watch(authStore, (state) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
});

export const login = async (username: string, pass: string) => {
    const res = await authService.login(username, pass);
    if (res.success) {
        authStore.isAuthenticated = true;
        authStore.user = username;
        authStore.isFirstLogin = res.isFirstLogin || false;
        return true;
    }
    return false;
};

export const logout = () => {
    authStore.isAuthenticated = false;
    authStore.user = null;
    authStore.isFirstLogin = false;
};

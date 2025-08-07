import axios from 'axios';

const Http = (isAuthenticated) => {
    const apiClient = axios.create({
        baseURL: import.meta.env.VITE_APP_API
    });

    if (isAuthenticated) {
        const token = localStorage.getItem('_token');
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    if (isAuthenticated) {
        apiClient.interceptors.response.use(
            (response) => {
                return response;
            },
            (error) => {
                if (error.response.status === 401) {
                    localStorage.removeItem('_token');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }
                return Promise.reject(error);
            }
        );
    }

    return apiClient;
};

export default Http;

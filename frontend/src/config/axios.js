import axios from 'axios';
//import dotenv from 'dotenv'

const axiosInstance = axios.create({
    baseURL: import.meta.env.BACKEND_API_URL || 'http://localhost:4000',
    headers: {
        "Authorization": `Bearer ${localStorage.getItem('token')}`
    }

})

axiosInstance.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  }, error => Promise.reject(error));
  

export default axiosInstance;   
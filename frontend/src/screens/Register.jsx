import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../config/axios'; // Assuming axiosInstance now
import { UserContext } from '../context/user.context';
import { Eye, EyeOff, Loader2, Lock, Mail ,User} from 'lucide-react';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(''); // Add error state

  const { setUser } = useContext(UserContext);
  const navigate = useNavigate();

  function submitHandler(e) {
    e.preventDefault();
    setIsLoading(true);
    setError(''); // Clear previous error

    axiosInstance.post('/users/register', { email, password })
      .then((res) => {
        console.log(res.data);
        localStorage.setItem('token', res.data.token);
        setUser(res.data.user);
        navigate('/');
      })
      .catch((err) => {
        // Get the error message from response data or use default message
        const errMsg = err.response?.data?.message || err.message;
        
        // Check for MongoDB duplicate key error
        if (typeof errMsg === 'string' && errMsg.includes('E11000 duplicate key error')) {
          setError('This email is already registered. Please use a different email.');
        } else {
          // Use the extracted message or default message
          setError(errMsg || 'Registration failed. Please try again.');
        }
        console.error(err.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  return (
    <div className="h-screen grid lg:grid-cols-2">
      {/* Left Side - Form */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-12 bg-gray-900">
        <div className="w-full max-w-md space-y-8">
          {/* Logo/Welcome */}
          <div className="text-center mb-8">
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <User     className="w-8 h-8 text-blue-500" />
              </div>
              <h1 className="text-2xl font-bold mt-2 text-white">Create Account</h1>
              <p className="text-gray-400">Sign up to get started</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={submitHandler} className="space-y-6">
            {error && (
              <div className="text-red-500 text-center bg-red-500/10 p-2 rounded-lg">
                {error}
              </div>
            )}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium text-gray-400">Email</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  className="input input-bordered w-full pl-10 bg-gray-700 h-[50px] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium text-gray-400">Password</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input input-bordered w-full pl-10 bg-gray-700 h-[50px] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="submit"
                className="btn btn-primary w-1/2 h-[60px] rounded-3xl bg-blue-500 hover:bg-blue-600 text-black font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5  animate-spin m-6" />
                    Loading...
                  </>
                ) : (
                  'Register'
                )}
              </button>
            </div>
          </form>

          <div className="text-center">
            <p className="text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-500 hover:underline">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Decorative */}
      <div className="hidden lg:flex flex-col justify-center items-center bg-gray-800 text-white p-12">
        <h2 className="text-3xl font-bold mb-4">Join Us!</h2>
        <p className="text-black text-center">
          <b>Register to start your journey and connect with others.</b>
        </p>
      </div>
    </div>
  );
};

export default Register;
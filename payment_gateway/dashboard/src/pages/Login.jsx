import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import "./Login.css";

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('test@example.com');
    const [password, setPassword] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        // Since this is Deliverable 1, we just mock login or verify against the test creds loosely
        if (email === 'test@example.com') {
            // Store flag in local storage
            localStorage.setItem('isAuthenticated', 'true');
            navigate('/dashboard');
        } else {
            alert('Invalid Credentials');
        }
    };

    return (
        <div className="login-container">
            <div className="login-form">
                <h2 className="login-title">Merchant Login</h2>
                <form data-test-id="login-form" onSubmit={handleLogin}>
                    <input
                        data-test-id="email-input"
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="login-input"
                    />
                    <input
                        data-test-id="password-input"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="login-input"
                    />
                    <button
                        data-test-id="login-button"
                        className="login-button"
                    >
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;

# AZURA ( Active Zone for Ultimate Real-time Application )

A full-stack web application featuring real-time chat, a code editor with execution capabilities, and AI integration. Built with modern technologies for seamless user experience and secure authentication.

## Features
- **User Authentication**: Secure login and registration using JWT (JSON Web Tokens).
- **Real-Time Chat**: Instant messaging powered by Socket.IO.
- **Code Editor**: In-browser code editing and execution using WebContainer.
- **AI Integration**: AI-powered features using the Gemini API.
- **Responsive Design**: Optimized for both desktop and mobile devices.

## Tech Stack

### Frontend
- **Vite**: Fast and modern frontend tooling for development and build.
- **Framework**:React(vite).

### Backend
- **Node.js**: JavaScript runtime for server-side logic.
- **Express.js**: Web framework for building RESTful APIs.
- **Socket.IO**: Real-time bidirectional communication for chat functionality.
- **JWT**: Token-based authentication system.

### Database
- **MongoDB**: NoSQL database hosted on MongoDB Cluster for scalable data storage.

### Additional Tools
- **WebContainer**: In-browser Node.js environment for running user code.
- **Gemini API**: AI capabilities integrated into the application.

## Prerequisites
Before running the project, ensure you have the following installed:
- **Node.js**: v16.x or higher
- **MongoDB**: Local instance or a MongoDB Cluster URI
- **npm**: Package manager (comes with Node.js)

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/petelmahetab/AZURA.git
   cd AZURA 
   ```
2.Install Dependencies:
   *For the frontend
      ```
      cd frontend
      npm install
      ```
   *For the backend
      ```
      cd backend
      npm install
      ```

3.Environment Variables:
    Create a .env file in the backend directory with the following:
     PORT=***
     MONGO_URI=*** 
     JWT_SECRET=***
     GEMINI_API_KEY=****     
4.VITE_API_URL=http://localhost:your-port

5.Run the Application
  Start Frontend and Backend 


Usage
Register/Login: Create an account or log in using your credentials.
Chat: Engage in real-time conversations with other users.
Code Editor: Write code in the editor and execute it directly in the browser.
AI Features: Interact with AI-powered tools (e.g., code suggestions, explanations) via the Gemini API.

****✈️Live link ('https://azura-with-me.vercel.app/')

  

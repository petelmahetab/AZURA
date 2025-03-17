import React, { useContext, useState, useEffect } from 'react';
import { UserContext } from '../context/user.context';
import axios from '../config/axios';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const { user } = useContext(UserContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [project, setProject] = useState([]);
  const navigate = useNavigate();

  function createProject(e) {
    e.preventDefault();
    console.log({ projectName });

    axios
      .post('/projects/create', {
        name: projectName,
      })
      .then((res) => {
        console.log(res);
        setIsModalOpen(false);
        setProject((prev) => [...prev, res.data.project]); // Add new project to list
        setProjectName('');
      })
      .catch((error) => {
        console.log(error);
      });
  }

  useEffect(() => {
    axios
      .get('/projects/all')
      .then((res) => {
        setProject(res.data.projects);
      })
      .catch((err) => {
        console.log(err);
      });
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <main className="min-h-screen w-full bg-gray-900 text-white p-6 font-sans overflow-hidden">
      {/* Header */}
      <header className="mb-8 animate-fade-in-down">
        <h1 className="text-4xl font-bold tracking-wide">
          <span className="text-indigo-400 animate-pulse text-5xl">Dashboard</span> 
        </h1>
        <p className="text-gray-400 mt-2">Manage and collaborate on your coding projects</p>
      </header>

      {/* Projects Grid */}
      <div className="projects grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* New Project Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="project flex items-center justify-center p-6 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-lg border border-gray-700 hover:bg-indigo-700 hover:scale-105 transform transition-all duration-300 group"
        >
          <div className="text-center">
            <i className="ri-add-circle-fill text-3xl text-indigo-400 group-hover:text-white transition-colors duration-300"></i>
            <p className="mt-2 text-lg font-semibold text-white">New Project</p>
          </div>
        </button>

        {/* Existing Projects */}
        {project.map((project) => (
          <div
            key={project._id}
            onClick={() => {
              navigate(`/project`, { state: { project } });
            }}
            className="project flex flex-col gap-3 p-6 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-lg border border-gray-700 cursor-pointer hover:bg-indigo-600 hover:scale-105 transform transition-all duration-300 animate-slide-up"
          >
            <h2 className="text-xl font-semibold text-indigo-300 truncate">{project.name}</h2>
            <div className="flex items-center gap-2 text-gray-300">
              <i className="ri-user-line text-indigo-400"></i>
              <p className="text-sm">
                <span className="font-medium">Collaborators:</span> {project.users.length}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for Creating New Project */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95 hover:scale-100">
            <h2 className="text-2xl font-semibold text-indigo-300 mb-6">Create New Project</h2>
            <form onSubmit={createProject}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Project Name</label>
                <input
                  onChange={(e) => setProjectName(e.target.value)}
                  value={projectName}
                  type="text"
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300 placeholder-gray-500"
                  placeholder="Enter project name"
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-all duration-300 transform hover:scale-105"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default Home;
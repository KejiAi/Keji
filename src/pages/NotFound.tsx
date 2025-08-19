import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // If a message was passed via navigate(), use it
  const message = location.state?.message;

  // If no message → treat it as a 404
  const is404 = !message;

  useEffect(() => {
    if (is404) {
      console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    } else {
      console.error("App Error:", message);
    }
  }, [is404, message, location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          {is404 ? "404" : "Error"}
        </h1>
        <p className="text-xl text-gray-600 mb-4">
          {message || "Oops! Page not found"}
        </p>
        <button
          onClick={() => navigate("/")}
          className="text-blue-500 hover:text-blue-700 underline"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
};

export default NotFound;

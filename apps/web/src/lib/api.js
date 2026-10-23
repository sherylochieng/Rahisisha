// Base URL for all API requests — change this one line when deploying to production
const API_URL = 'http://localhost:3000/v1';

// Central fetch wrapper — every API call goes through here
// Handles: setting headers, sending cookies, parsing JSON, throwing errors
async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' }, // tell the API we're sending JSON
    credentials: 'include',                           // send the auth cookie with every request
    ...options,                                       // merge in method, body, etc from the caller
  });

  const data = await res.json(); // parse the response body as JSON

  if (!res.ok) {
    // if the API returned 4xx or 5xx, throw so the component's catch block handles it
    throw new Error(data.error || 'Something went wrong');
  }

  return data; // return the parsed response to the component
}

// All API calls live here — one method per endpoint
export const api = {
  // POST /signup — create a new tenant + user + membership
  signup(body) {
    return request('/signup', {
      method: 'POST',
      body: JSON.stringify(body), // convert JS object to JSON string
    });
  },

  // POST /login — verify credentials and set auth cookie
  login(body) {
    return request('/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Fetch the current logged-in user and their tenant
  me() {
    return request('/me');
  },
  
};
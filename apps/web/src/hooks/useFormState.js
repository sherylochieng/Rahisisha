import { useState } from 'react';

export function useFormState() {

  const [error, setError] = useState('');
  // error — the message to show in the red banner
  // starts as empty string — empty string is falsy — so no banner shows on load

  const [loading, setLoading] = useState(false);
  // loading — is the API call currently in flight?
  // starts as false — button is enabled, shows normal text

  function startSubmit() {
    setError('');       // wipe any old error from a previous failed attempt
    setLoading(true);   // lock the button, show "Creating account..."
  }
  // called at the TOP of every submit handler — before any async work

  function failSubmit(message) {
    setError(message);    // show the error message in the red banner
    setLoading(false);    // unlock the button so user can try again
  }
  // called in the catch block — when the API returned an error

  function resetSubmit() {
    setLoading(false);    // unlock the button, keep error as-is
  }
  // called in finally — when you want to stop the spinner regardless of outcome

  return { error, loading, startSubmit, failSubmit, resetSubmit };
  // return everything the form needs
  // the form destructures only what it needs from this object
}
import { ref, onBeforeUnmount } from 'vue';

// Wraps SpeechRecognition/webkitSpeechRecognition (fr-FR). Callers must check
// `.supported` and fall back to a plain text input when it's false — notably
// on iOS Safari, where Web Speech support is unreliable per the spec.
export function useSpeechRecognition() {
  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SpeechRecognitionImpl;

  const listening = ref(false);
  const transcript = ref('');
  const error = ref(null);

  let recognition = null;
  if (supported) {
    recognition = new SpeechRecognitionImpl();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      transcript.value = text;
    };
    recognition.onerror = (event) => {
      error.value = event.error;
      listening.value = false;
    };
    recognition.onend = () => {
      listening.value = false;
    };
  }

  function start() {
    if (!supported || listening.value) return;
    error.value = null;
    transcript.value = '';
    try {
      recognition.start();
      listening.value = true;
    } catch (e) {
      error.value = e.message;
    }
  }

  function stop() {
    if (!supported || !listening.value) return;
    recognition.stop();
  }

  onBeforeUnmount(() => {
    if (recognition && listening.value) recognition.stop();
  });

  return { supported, listening, transcript, error, start, stop };
}

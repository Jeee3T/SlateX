// Custom Exit Modal Handler - Replace the confirm() code in canvas.js lines 1772-1787

const currentRoom = JSON.parse(localStorage.getItem('currentRoom') || '{}');

// Create custom confirmation modal (avoids browser dialog being blocked)
const modal = document.createElement('div');
modal.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(5, 0, 56, 0.6);
  backdrop-filter: blur(4px);
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const dialog = document.createElement('div');
dialog.style.cssText = `
  background: white;
  padding: 32px;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  text-align: center;
`;

dialog.innerHTML = `
  <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #050038;">Exit Room?</h2>
  <p style="margin: 0 0 24px 0; color: #666; font-size: 14px;">The room will be saved before you exit.</p>
  <div style="display: flex; gap: 12px; justify-content: center;">
    <button id="cancel-exit" style="
      padding: 12px 24px;
      border: 1px solid #ddd;
      background: white;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
    ">Cancel</button>
    <button id="confirm-exit" style="
      padding: 12px 24px;
      border: none;
      background: #ef4444;
      color: white;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
    ">Exit Room</button>
  </div>
`;

modal.appendChild(dialog);
document.body.appendChild(modal);

// Cancel handler
document.getElementById('cancel-exit').onclick = () => {
    modal.remove();
};

// Confirm handler
document.getElementById('confirm-exit').onclick = async () => {
    const confirmBtn = document.getElementById('confirm-exit');
    confirmBtn.disabled = true;
    confirmBtn.innerText = 'Saving...';

    // Save room state (only if owner)
    await saveRoomOnExit(false);

    // Clean up
    localStorage.removeItem('currentRoom');

    // Redirect to room selection
    window.location.href = '/room';
};

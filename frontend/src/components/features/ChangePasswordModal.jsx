import { useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Input from '../ui/Input.jsx';
import Button from '../ui/Button.jsx';
import { changePassword, skipPasswordChange } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';

export default function ChangePasswordModal({ open, onClose, isFirstLogin = false }) {
  const { clearPasswordChangeRequired } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!newPassword) errs.newPassword = 'Password is required';
    else if (newPassword.length < 8) errs.newPassword = 'Must be at least 8 characters';
    if (newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await changePassword(newPassword);
      clearPasswordChangeRequired();
      toast.success('Password changed successfully');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    try {
      await skipPasswordChange();
      clearPasswordChangeRequired();
      toast('Password change skipped', { icon: '⏭️' });
      onClose();
    } catch {
      toast.error('Failed to skip');
    }
  };

  const handleClose = () => {
    if (!isFirstLogin) {
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
      onClose();
    }
    // If first login, don't allow closing via X — must change or skip
  };

  return (
    <Modal open={open} onClose={handleClose} title="Change Password">
      <form onSubmit={handleSubmit} className="space-y-4">
        {isFirstLogin && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-900/20 border border-amber-700/30">
            <KeyRound size={20} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-200">
              You're using the default password. It's recommended to change it for security.
            </p>
          </div>
        )}

        <Input
          label="New Password"
          type="password"
          value={newPassword}
          onChange={e => { setNewPassword(e.target.value); setErrors(er => ({ ...er, newPassword: undefined })); }}
          error={errors.newPassword}
          placeholder="Minimum 8 characters"
          autoFocus
        />

        <Input
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={e => { setConfirmPassword(e.target.value); setErrors(er => ({ ...er, confirmPassword: undefined })); }}
          error={errors.confirmPassword}
          placeholder="Re-enter new password"
        />

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? 'Changing...' : 'Change Password'}
          </Button>
          {isFirstLogin ? (
            <Button type="button" variant="ghost" onClick={handleSkip}>
              Skip
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}

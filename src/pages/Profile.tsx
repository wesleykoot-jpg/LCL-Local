import { useNavigate } from 'react-router-dom';
import { FloatingNav } from '@/components/FloatingNav';
import { ProfileView } from '@/components/ProfileView';
import { DebugConnection } from '@/components/DebugConnection';

const Profile = () => {
  const navigate = useNavigate();

  const handleNavigate = (view: 'feed' | 'map' | 'profile') => {
    if (view === 'feed') navigate('/feed');
    else if (view === 'map') navigate('/map');
    else if (view === 'profile') navigate('/profile');
  };

  return (
    <>
      <DebugConnection />
      <ProfileView />
      <FloatingNav activeView="profile" onNavigate={handleNavigate} />
    </>
  );
};

export default Profile;

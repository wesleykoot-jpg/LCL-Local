import { FloatingNav } from '@/components/FloatingNav';
import { ProfileView } from '@/components/ProfileView';

const Profile = () => {
  return (
    <>
      <ProfileView />
      <FloatingNav activeView="profile" onNavigate={handleNavigate} />
    </>
  );
};

export default Profile;

import { FloatingNav } from '@/components/FloatingNav';
import { ProfileView } from '@/components/ProfileView';

const Profile = () => {
  return (
    <>
      <ProfileView />
      <FloatingNav activeView="profile" />
    </>
  );
};

export default Profile;

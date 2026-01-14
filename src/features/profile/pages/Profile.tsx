import { FloatingNav } from '@/shared/components';
import { ProfileView } from '../components/ProfileView';

const Profile = () => {
  return (
    <>
      <ProfileView />
      <FloatingNav activeView="profile" />
    </>
  );
};

export default Profile;

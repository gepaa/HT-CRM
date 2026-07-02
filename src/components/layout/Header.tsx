import React from 'react';
import { Topbar, type TopbarProps } from './Topbar';

export type { TopbarProps as HeaderProps };
export const Header: React.FC<TopbarProps> = (props) => <Topbar {...props} />;
export default Header;

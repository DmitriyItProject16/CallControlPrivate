import { IRemoteControlLoader } from '@directum/sungero-remote-component-types';
import * as CallControlLoader from './src/loaders/call-control-loader';

// Загрузчики контролов компонента.
const loaders: Record<string, IRemoteControlLoader> = {
  'call-control-loader': CallControlLoader
};

export default loaders;

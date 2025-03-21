import { WebContainer } from '@webcontainer/api';

let webContainerInstance = null;

export const getWebContainer = async () => {
  if (webContainerInstance === null) {
    try {
      console.log('Booting WebContainer...');
      webContainerInstance = await WebContainer.boot();
      console.log('WebContainer booted successfully');
    } catch (error) {
      console.error('Failed to boot WebContainer:', error);
      throw error;
    }
  } else {
    console.log('Returning existing WebContainer instance');
  }
  return webContainerInstance;
};

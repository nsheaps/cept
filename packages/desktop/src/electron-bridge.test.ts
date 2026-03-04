import { describe, it, expect, vi } from 'vitest';
import { ElectronBridge, IPC_CHANNELS } from './electron-bridge.js';
import type { ElectronIPC } from './electron-bridge.js';

function createMockIPC(): ElectronIPC {
  return {
    invoke: vi.fn(async () => undefined),
    on: vi.fn(() => () => {}),
    send: vi.fn(),
  };
}

describe('ElectronBridge', () => {
  it('has electron platform identifier', () => {
    const bridge = new ElectronBridge(createMockIPC());
    expect(bridge.platform).toBe('electron');
  });

  it('reports full capabilities', () => {
    const bridge = new ElectronBridge(createMockIPC());
    expect(bridge.capabilities.fileSystem).toBe(true);
    expect(bridge.capabilities.fileDialogs).toBe(true);
    expect(bridge.capabilities.nativeMenu).toBe(true);
    expect(bridge.capabilities.notifications).toBe(true);
    expect(bridge.capabilities.clipboard).toBe(true);
  });

  it('initialize succeeds with valid IPC', async () => {
    const bridge = new ElectronBridge(createMockIPC());
    await expect(bridge.initialize()).resolves.toBeUndefined();
  });

  it('showOpenDialog invokes IPC', async () => {
    const ipc = createMockIPC();
    (ipc.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      canceled: false,
      filePaths: ['/home/user/docs'],
    });

    const bridge = new ElectronBridge(ipc);
    const result = await bridge.showOpenDialog({
      title: 'Open Folder',
      properties: ['openDirectory'],
    });

    expect(ipc.invoke).toHaveBeenCalledWith(
      IPC_CHANNELS.SHOW_OPEN_DIALOG,
      expect.objectContaining({ title: 'Open Folder' }),
    );
    expect(result.canceled).toBe(false);
    expect(result.filePaths).toEqual(['/home/user/docs']);
  });

  it('showSaveDialog invokes IPC', async () => {
    const ipc = createMockIPC();
    (ipc.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      canceled: false,
      filePaths: ['/home/user/export.md'],
    });

    const bridge = new ElectronBridge(ipc);
    const result = await bridge.showSaveDialog({ title: 'Save' });

    expect(ipc.invoke).toHaveBeenCalledWith(
      IPC_CHANNELS.SHOW_SAVE_DIALOG,
      expect.objectContaining({ title: 'Save' }),
    );
    expect(result.filePaths[0]).toBe('/home/user/export.md');
  });

  it('setTitle sends IPC message', () => {
    const ipc = createMockIPC();
    const bridge = new ElectronBridge(ipc);
    bridge.setTitle('My Workspace');
    expect(ipc.send).toHaveBeenCalledWith(IPC_CHANNELS.SET_TITLE, 'My Workspace');
  });

  it('setMenu sends IPC message', () => {
    const ipc = createMockIPC();
    const bridge = new ElectronBridge(ipc);
    const menu = [{ id: 'file', label: 'File' }];
    bridge.setMenu(menu);
    expect(ipc.send).toHaveBeenCalledWith(IPC_CHANNELS.SET_MENU, menu);
  });

  it('showNotification sends IPC message', () => {
    const ipc = createMockIPC();
    const bridge = new ElectronBridge(ipc);
    bridge.showNotification({ title: 'Sync', body: 'Complete' });
    expect(ipc.send).toHaveBeenCalledWith(
      IPC_CHANNELS.SHOW_NOTIFICATION,
      { title: 'Sync', body: 'Complete' },
    );
  });

  it('readClipboard invokes IPC', async () => {
    const ipc = createMockIPC();
    (ipc.invoke as ReturnType<typeof vi.fn>).mockResolvedValue('clipboard text');

    const bridge = new ElectronBridge(ipc);
    const text = await bridge.readClipboard();
    expect(text).toBe('clipboard text');
    expect(ipc.invoke).toHaveBeenCalledWith(IPC_CHANNELS.READ_CLIPBOARD);
  });

  it('writeClipboard invokes IPC', async () => {
    const ipc = createMockIPC();
    const bridge = new ElectronBridge(ipc);
    await bridge.writeClipboard('hello');
    expect(ipc.invoke).toHaveBeenCalledWith(IPC_CHANNELS.WRITE_CLIPBOARD, 'hello');
  });

  it('onMenuAction subscribes to IPC events', () => {
    const ipc = createMockIPC();
    const bridge = new ElectronBridge(ipc);
    const callback = vi.fn();
    bridge.onMenuAction(callback);
    expect(ipc.on).toHaveBeenCalledWith(IPC_CHANNELS.MENU_ACTION, expect.any(Function));
  });

  it('onWindowStateChange subscribes to IPC events', () => {
    const ipc = createMockIPC();
    const bridge = new ElectronBridge(ipc);
    bridge.onWindowStateChange(vi.fn());
    expect(ipc.on).toHaveBeenCalledWith(
      IPC_CHANNELS.WINDOW_STATE_CHANGE,
      expect.any(Function),
    );
  });

  it('dispose cleans up subscriptions', async () => {
    const unsub = vi.fn();
    const ipc = createMockIPC();
    (ipc.on as ReturnType<typeof vi.fn>).mockReturnValue(unsub);

    const bridge = new ElectronBridge(ipc);
    bridge.onMenuAction(() => {});
    bridge.onWindowStateChange(() => {});

    await bridge.dispose();
    expect(unsub).toHaveBeenCalledTimes(2);
  });

  it('getWindowState returns current state', () => {
    const bridge = new ElectronBridge(createMockIPC());
    const state = bridge.getWindowState();
    expect(state).toHaveProperty('focused');
    expect(state).toHaveProperty('width');
    expect(state).toHaveProperty('height');
  });

  it('createLocalBackend invokes IPC', async () => {
    const ipc = createMockIPC();
    const bridge = new ElectronBridge(ipc);
    await bridge.createLocalBackend('/home/user/workspace');
    expect(ipc.invoke).toHaveBeenCalledWith(
      IPC_CHANNELS.CREATE_LOCAL_BACKEND,
      '/home/user/workspace',
    );
  });
});

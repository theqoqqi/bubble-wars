import { useState } from 'react';
import { MenuScreen } from './components/MenuScreen';
import { GameScreen } from './components/GameScreen';

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'game'>('menu');
  const [name, setName] = useState('Игрок');

  return (
    <div className="h-screen w-screen overflow-hidden bg-abyss">
      {screen === 'menu' ? (
        <MenuScreen name={name} onName={setName} onPlay={() => setScreen('game')} />
      ) : (
        <GameScreen name={name} onExit={() => setScreen('menu')} />
      )}
    </div>
  );
}

/**
 * Fenetres qui remontent au-dessus du clavier.
 *
 * Un champ cache par le clavier, c'est une saisie a l'aveugle : l'ouvrier ne
 * voit plus ce qu'il tape, ni le bouton pour envoyer. A l'inverse, une
 * fenetre centree remontee de toute la hauteur du clavier se retrouvait
 * plaquee en haut de l'ecran, titre coupe. Ces tests fixent le decalage selon
 * l'ancrage, et la resistance aux soubresauts du clavier iOS entre deux
 * champs.
 *
 * Reanimated tourne ici en JavaScript : `getAnimatedStyle` lit le style
 * courant, et les minuteries simulees font avancer les animations.
 */
import React from 'react';
import { Dimensions, Keyboard, type KeyboardEvent } from 'react-native';
import Animated, { getAnimatedStyle } from 'react-native-reanimated';
import { act, render, screen } from '@testing-library/react-native';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';

type Options = Parameters<typeof useKeyboardAwareModalStyle>[0];
type Ecouteur = (e: KeyboardEvent) => void;

const ecouteurs: Record<string, Ecouteur> = {};

function Fenetre(props: { options?: Options }) {
  const style = useKeyboardAwareModalStyle(props.options);
  return <Animated.View testID="fenetre" style={style} />;
}

function style(): { transform: { translateY: number }[]; maxHeight: number } {
  return getAnimatedStyle(screen.getByTestId('fenetre')) as { transform: { translateY: number }[]; maxHeight: number };
}

/** `+ 0` ramene un -0 (clavier ferme : -0 * ratio) a 0. */
function decalage(): number {
  return style().transform[0].translateY + 0;
}

/** Le clavier apparait (iOS : `keyboardWillShow`), puis l'animation se termine. */
function clavierOuvert(hauteur: number): void {
  act(() => ecouteurs.keyboardWillShow({ endCoordinates: { height: hauteur } } as KeyboardEvent));
  act(() => jest.advanceTimersByTime(400));
}

const HAUTEUR_ECRAN = Dimensions.get('window').height;

beforeEach(() => {
  jest.useFakeTimers();
  for (const k of Object.keys(ecouteurs)) delete ecouteurs[k];
  jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined);
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((evenement: string, ecouteur: Ecouteur) => {
    ecouteurs[evenement] = ecouteur;
    return { remove: jest.fn() };
  }) as unknown as typeof Keyboard.addListener);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Decalage selon l ancrage', () => {
  it('un volet colle en bas remonte de toute la hauteur du clavier', () => {
    render(<Fenetre />);
    clavierOuvert(300);

    expect(decalage()).toBe(-300);
  });

  it('une fenetre centree ne remonte que de la moitie du clavier', () => {
    render(<Fenetre options={{ anchor: 'center' }} />);
    clavierOuvert(300);

    expect(decalage()).toBe(-150);
  });

  it('limite la hauteur a la zone restee visible au-dessus du clavier', () => {
    render(<Fenetre options={{ maxHeightRatio: 0.5 }} />);
    clavierOuvert(300);

    expect(style().maxHeight).toBeCloseTo((HAUTEUR_ECRAN - 300) * 0.5, 5);
  });

  it('une fenetre fermee reste immobile, meme clavier ouvert', () => {
    // Plusieurs fenetres sont montees sur le meme ecran : une fenetre fermee
    // ne doit pas reagir au clavier ouvert par une autre.
    render(<Fenetre options={{ visible: false }} />);
    clavierOuvert(300);

    expect(decalage()).toBe(0);
    expect(style().maxHeight).toBeCloseTo(HAUTEUR_ECRAN * 0.85, 5);
  });

  it('se place au-dessus du clavier deja ouvert quand elle s ouvre', () => {
    const { rerender } = render(<Fenetre options={{ visible: false, anchor: 'center' }} />);
    clavierOuvert(300);

    rerender(<Fenetre options={{ visible: true, anchor: 'center' }} />);
    act(() => jest.advanceTimersByTime(50));

    expect(decalage()).toBe(-150);
  });
});

describe('Clavier deja ouvert ou instable', () => {
  it('se place tout de suite si le clavier etait deja ouvert a l ouverture', () => {
    jest.spyOn(Keyboard, 'metrics').mockReturnValue({ height: 280, screenX: 0, screenY: 0, width: 400 });
    render(<Fenetre options={{ anchor: 'center' }} />);

    expect(decalage()).toBe(-140);
  });

  it('ignore une fermeture aussitot suivie d une reouverture (passage d un champ a l autre)', () => {
    render(<Fenetre />);
    clavierOuvert(300);

    act(() => ecouteurs.keyboardWillHide({} as KeyboardEvent));
    act(() => jest.advanceTimersByTime(50));
    clavierOuvert(300);

    expect(decalage()).toBe(-300);
  });

  it('redescend une fois le clavier vraiment ferme', () => {
    render(<Fenetre />);
    clavierOuvert(300);

    act(() => ecouteurs.keyboardWillHide({} as KeyboardEvent));
    act(() => jest.advanceTimersByTime(600));

    expect(decalage()).toBe(0);
  });

  it('ignore un petit changement de hauteur (barre de suggestions iOS)', () => {
    render(<Fenetre />);
    clavierOuvert(300);
    clavierOuvert(340);

    expect(decalage()).toBe(-300);
  });

  it('suit un vrai changement de clavier', () => {
    render(<Fenetre />);
    clavierOuvert(300);
    clavierOuvert(400);

    expect(decalage()).toBe(-400);
  });
});

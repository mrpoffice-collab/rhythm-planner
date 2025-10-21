import { Domain } from '../db/database';

export const domainColors: Record<Domain, string> = {
  Work: '#3A5BA0',
  SideHustle: '#7B68EE',
  Chore: '#8FAE8F',
  Errand: '#D6A656',
  Personal: '#D58B7C',
  Creative: '#A88FB0',
  Unplanned: '#9E9E9E',
};

// Extended colors for Free/Rest blocks
export const extendedColors: Record<string, string> = {
  ...domainColors,
  Free: '#90CAF9',
  Rest: '#CE93D8',
};

export const domainColorClasses: Record<Domain, {
  bg: string;
  border: string;
  text: string;
  hover: string;
}> = {
  Work: {
    bg: 'bg-work',
    border: 'border-work',
    text: 'text-work',
    hover: 'hover:bg-work/90',
  },
  SideHustle: {
    bg: 'bg-sidehustle',
    border: 'border-sidehustle',
    text: 'text-sidehustle',
    hover: 'hover:bg-sidehustle/90',
  },
  Chore: {
    bg: 'bg-chore',
    border: 'border-chore',
    text: 'text-chore',
    hover: 'hover:bg-chore/90',
  },
  Errand: {
    bg: 'bg-errand',
    border: 'border-errand',
    text: 'text-errand',
    hover: 'hover:bg-errand/90',
  },
  Personal: {
    bg: 'bg-personal',
    border: 'border-personal',
    text: 'text-personal',
    hover: 'hover:bg-personal/90',
  },
  Creative: {
    bg: 'bg-creative',
    border: 'border-creative',
    text: 'text-creative',
    hover: 'hover:bg-creative/90',
  },
  Unplanned: {
    bg: 'bg-gray-500',
    border: 'border-gray-500',
    text: 'text-gray-500',
    hover: 'hover:bg-gray-500/90',
  },
};

export const getDomainColor = (domain: Domain | string): string => {
  if (domain in extendedColors) {
    return extendedColors[domain];
  }
  return '#6B7280'; // Default gray
};

export const getDomainClasses = (domain: Domain) => {
  return domainColorClasses[domain];
};

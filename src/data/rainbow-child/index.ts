import type { Drawing } from '../types'
import { palette } from './palette'
import { regions } from './regions'

/** Simplified playable vector interpretation of the two images supplied in chat. */
export const rainbowChild: Drawing = {
  id: 'rainbow-child',
  revision: 1,
  title: '무지개를 바라보는 아이',
  kind: 'official',
  viewBox: [0, 0, 800, 1000],
  labelSize: 28,
  strokeWidth: 3,
  strokeColor: '#34332D',
  colors: palette,
  regions,
  decorations: [
    {
      d: 'M716 526 C687 536 674 564 650 603 C610 668 584 684 549 695 Q532 702 536 719 L564 724 C612 707 634 679 660 635 L720 541 Z',
      stroke: '#34332D',
      fill: '#FFAD83',
      paintWith: 'slide-body',
    },
    {
      d: 'M687 420 L711 416 L711 697 L687 697 Z M766 411 L792 418 L792 707 L766 707 Z',
      stroke: '#34332D',
      fill: '#EDA934',
    },
    {
      d: 'M208 881 Q238 904 276 904 Q295 903 308 899 L307 919 Q267 937 221 917 Q201 910 204 893 Z',
      stroke: '#34332D',
      fill: '#fff',
    },
    {
      d: 'M338 884 Q371 905 413 904 Q431 904 441 899 L440 919 Q395 936 351 916 Q333 909 335 896 Z',
      stroke: '#34332D',
      fill: '#fff',
    },
    // Broad facial features and tiny trim stay decorative, avoiding fiddly paint cells.
    {
      d: 'M300 329 C300 308 322 305 328 325 C336 349 307 352 300 329 Z M373 307 C373 287 394 284 401 304 C411 326 382 332 373 307 Z',
      stroke: '#242621',
      fill: '#242621',
    },
    {
      d: 'M309 320 A5 7 0 1 0 319 320 A5 7 0 1 0 309 320 Z M382 300 A5 7 0 1 0 392 300 A5 7 0 1 0 382 300 Z',
      stroke: '#fff',
      fill: '#fff',
      strokeWidth: 1,
    },
    {
      d: 'M288 307 Q297 292 313 297 M370 280 Q385 271 396 280 M356 337 Q361 326 368 335',
      stroke: '#34332D',
    },
    {
      d: 'M350 377 Q375 376 397 357 Q398 391 377 396 Q360 397 350 377 Z',
      stroke: '#34332D',
      fill: '#fff',
    },
    {
      d: 'M361 387 Q376 378 391 383 Q382 401 361 387 Z',
      stroke: '#34332D',
      fill: '#F47E89',
      strokeWidth: 2,
    },
    {
      d: 'M257 388 Q245 374 263 375 M221 353 Q253 358 283 328 M121 446 Q154 423 149 364',
      stroke: '#663C24',
    },
    { d: 'M361 507 Q379 590 371 706', stroke: '#92771C' },
    {
      d: 'M373 539 A7 7 0 1 0 387 539 A7 7 0 1 0 373 539 Z M379 590 A7 7 0 1 0 393 590 A7 7 0 1 0 379 590 Z M381 650 A7 7 0 1 0 395 650 A7 7 0 1 0 381 650 Z',
      stroke: '#92771C',
      fill: '#FFE775',
      strokeWidth: 2,
    },
    {
      d: 'M74 463 L81 629 M149 463 L144 629',
      stroke: '#605A35',
      strokeWidth: 4,
    },
    {
      d: 'M18 702 l5 -11 6 11 M105 706 l6 -12 6 12 M471 730 l5 -11 6 11 M511 704 l6 -11 6 11',
      stroke: '#628E38',
      strokeWidth: 3,
    },
    {
      d: 'M168 931 Q194 947 218 946 M437 941 Q480 934 484 920 M86 775 Q127 762 177 776',
      stroke: '#2082B7',
      strokeWidth: 3,
    },
    {
      d: 'M744 867 C721 843 701 873 722 884 C699 902 725 921 740 898 C758 918 778 894 759 883 C781 864 755 846 744 867 Z',
      stroke: '#34332D',
      fill: '#fff',
      strokeWidth: 3,
    },
    {
      d: 'M731 882 A9 9 0 1 0 749 882 A9 9 0 1 0 731 882 Z',
      stroke: '#EDC74D',
      fill: '#EDC74D',
      strokeWidth: 1,
    },
  ],
}

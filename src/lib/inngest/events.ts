/**
 * Event contracts for Galuxium Extraction Queue.
 */
export type DocumentValidatedEvent = {
  name: 'document/validated';
  data: {
    documentId: string;
    orgId: string;
    version?: number;
  };
};

export type GaluxiumEvents = {
  'document/validated': DocumentValidatedEvent;
};

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "color" TEXT,
ADD COLUMN     "priority" INTEGER;

ALTER TABLE "Project" ADD CONSTRAINT "project_color_check"
CHECK (color IN (
  'blue', 'lightBlue', 'purple', 'lightPurple',
  'red', 'pink', 'orange', 'lightOrange',
  'yellow', 'green', 'lightGreen', 'gray', 'brown'
));

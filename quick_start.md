## QUICK TUTORIAL

### Creating a new board
The first time you use BoardCAD it is natural that you
don't have any existing models to start from.
BoardCAD comes with three basic shapes (funboard,
shortboard, and longboard) that serve as starting
points. You create a new board from new in the file menu.
Don't worry too much if the shape you start with is far from
what you had in mind, you can make any board from any starting point.

### Scale the board
The first thing we want to do is to scale the board to the
desired size. If you are used to working with feet and inches like most shapers, 
make sure that you select imperial units in the dropdown on the toolbar.
Now click the scale button and type in the desired measures, f.ex.
5'10" x 20" x 2.25". Note that you can input dimension either in fractions or
decimals regardsless of what unit is selected. You can also input values in
other units such as mm or m as long as you provide the unit.

### Edit the board
Start with the outline. 
The outline is defined as a Bezier curve made up of
segments. Each segment starts at a blue
control point and ends at the next blue control point.
Between those two blue points there is a red and a yellow
control point. These define the form of the curve within the specific
segment. You can control the shape of the outline by
clicking and dragging the control points. To ensure the
the curve is continuous between two segments, click a control point to
select it and check "continuous" in the lower right corner.
You can add or remove control points by right clicking to open the menu and
selecting the add control point option from the pop up menu. After selecting,
click anywhere on the curve to add a control point. 

![Info](./images/info.png)`When adding a control point the curve remains the same`

Click on profile tab to work on deck and rocker. You
can switch between deck and rocker by clicking the "Toggle
Deck/Bottom" icon or hotkey B.
Multiple control points can be selected and moved
at the same time, which is useful for changing the
rocker in the tail and nose while maintaining the same
thickness. Select multiple control point by dragging a box around
them or by clicking multiple control points while holding down CTRL.
The cross sections are responsible for the form of the rails, and how all the lines
flow in 3D. To ensure a good flow it is advisable to use few
cross sections. One trick is to start with only one cross
section in the center of the board and edit that to the
desired form. Next you add cross section for example at 1
foot from the tail and 1 foot from the nose. These cross
sections will now be copies of the cross section at the center
of the board and it is easy to control how you want the flow
of rail to change towards the tail and towards the nose.
It may also be necessary to define extra cross
sections for the last few inches of the board. By doing this
after we have edited the cross sections at one foot off the
tail and nose, we again make it easy to change the rail
without breaking the flow.

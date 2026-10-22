using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Ink;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Effects;
using System.Windows.Shapes;

namespace EpicPenDesktop
{
    public class Program
    {
        [STAThread]
        public static void Main()
        {
            var app = new Application();
            app.Run(new MainWindow());
        }
    }

    public class MainWindow : Window
    {
        [DllImport("user32.dll")]
        private static extern int GetWindowLong(IntPtr hwnd, int index);

        [DllImport("user32.dll")]
        private static extern int SetWindowLong(IntPtr hwnd, int index, int newStyle);

        private const int GWL_EXSTYLE = -20;
        private const int WS_EX_TRANSPARENT = 0x00000020;
        private const int WS_EX_LAYERED = 0x00080000;
        private const int WS_EX_TOOLWINDOW = 0x00000080;

        private Window overlayWindow;
        private InkCanvas inkCanvas;
        private IntPtr overlayHwnd;

        // Current Tool State
        private string currentTool = "pen";
        private Color currentColor = Color.FromRgb(255, 90, 40); // iOS Vibrant Coral Orange
        private double strokeSize = 6.0;
        private string boardMode = "transparent";

        // Main Toolbar Buttons
        private Button btnMouse;
        private Button btnPen;
        private Button btnHigh;
        private Button btnErase;
        private Button btnBoard;
        private Button btnColorCircle;

        // In-Window Liquid Glass Flyout Panel
        private Border flyoutCard;
        private TranslateTransform flyoutTranslate;
        private bool isFlyoutOpen = false;
        private List<Border> popupColorBorders = new List<Border>();
        private List<Button> popupSizeButtons = new List<Button>();

        // 12 Curated Apple-Grade Colors
        private readonly Color[] paletteColors = new Color[]
        {
            Color.FromRgb(255, 90, 40),  // Apple Coral
            Color.FromRgb(255, 179, 0),  // Sunset Amber
            Color.FromRgb(52, 199, 89),  // iOS Emerald Green
            Color.FromRgb(48, 209, 88),  // Mint Cyan
            Color.FromRgb(0, 122, 255),  // macOS Royal Blue
            Color.FromRgb(175, 82, 222), // Apple Purple
            Color.FromRgb(255, 45, 85),  // Vivid Pink
            Color.FromRgb(255, 255, 255),// Pure Crisp White
            Color.FromRgb(255, 59, 48),  // Apple Red
            Color.FromRgb(90, 200, 250), // Sky Blue
            Color.FromRgb(162, 132, 94), // Warm Bronze
            Color.FromRgb(99, 110, 125)  // Graphite Slate
        };

        private readonly double[] strokeSizes = new double[] { 3.0, 6.0, 10.0, 18.0 };

        private readonly Brush hitTestBrush = new SolidColorBrush(Color.FromArgb(1, 0, 0, 0));

        public MainWindow()
        {
            this.Title = "InkOver";
            this.WindowStyle = WindowStyle.None;
            this.AllowsTransparency = true;
            this.Background = Brushes.Transparent;
            this.Topmost = true;
            this.ShowInTaskbar = true;
            this.SizeToContent = SizeToContent.WidthAndHeight;
            this.Left = 50;
            this.Top = 100;
            this.ResizeMode = ResizeMode.NoResize;

            BuildOverlayWindow();

            // Set Toolbar Owner to Overlay: Guarantees toolbar is PERMANENTLY above drawing canvas
            this.Owner = overlayWindow;

            BuildCombinedUI();

            this.StateChanged += (s, e) =>
            {
                if (overlayWindow == null) return;
                if (this.WindowState == WindowState.Minimized)
                {
                    overlayWindow.Visibility = Visibility.Hidden;
                }
                else if (this.WindowState == WindowState.Normal)
                {
                    overlayWindow.Visibility = Visibility.Visible;
                }
            };

            this.KeyDown += HandleGlobalKeys;

            this.Loaded += (s, e) =>
            {
                SelectTool("pen");
            };
        }

        private void HandleGlobalKeys(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.D1) SelectTool("pen");
            else if (e.Key == Key.D2) SelectTool("highlighter");
            else if (e.Key == Key.D3) SelectTool("eraser");
            else if (e.Key == Key.G) SelectTool("cursor");
            else if (e.Key == Key.B) ToggleBoardMode();
            else if (e.Key == Key.C) ClearCanvas();
            else if (e.Key == Key.Escape)
            {
                if (isFlyoutOpen)
                {
                    ToggleFlyout(false);
                    return;
                }
                if (boardMode != "transparent") ToggleBoardMode();
                SelectTool("cursor");
            }
            else if (e.Key == Key.Z && (Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control)
            {
                UndoStroke();
            }
        }

        private void BuildOverlayWindow()
        {
            overlayWindow = new Window
            {
                WindowStyle = WindowStyle.None,
                AllowsTransparency = true,
                Background = hitTestBrush,
                Topmost = true,
                ShowInTaskbar = false,
                Left = SystemParameters.VirtualScreenLeft,
                Top = SystemParameters.VirtualScreenTop,
                Width = SystemParameters.VirtualScreenWidth,
                Height = SystemParameters.VirtualScreenHeight,
                ResizeMode = ResizeMode.NoResize
            };

            inkCanvas = new InkCanvas
            {
                Background = hitTestBrush,
                UseCustomCursor = true,
                Cursor = Cursors.Pen,
                DefaultDrawingAttributes = new DrawingAttributes
                {
                    Color = currentColor,
                    Width = strokeSize,
                    Height = strokeSize,
                    FitToCurve = true,
                    IgnorePressure = false,
                    IsHighlighter = false
                }
            };

            overlayWindow.Content = inkCanvas;
            overlayWindow.Show();

            var helper = new WindowInteropHelper(overlayWindow);
            overlayHwnd = helper.Handle;

            int exStyle = GetWindowLong(overlayHwnd, GWL_EXSTYLE);
            SetWindowLong(overlayHwnd, GWL_EXSTYLE, exStyle | WS_EX_LAYERED | WS_EX_TOOLWINDOW);

            overlayWindow.KeyDown += HandleGlobalKeys;
        }

        private void BuildCombinedUI()
        {
            var mainGrid = new Grid();
            mainGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            mainGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            // ==================== COLUMN 0: LIQUID GLASS PILL TOOLBAR ====================
            var glassBg = new LinearGradientBrush
            {
                StartPoint = new Point(0, 0),
                EndPoint = new Point(0, 1)
            };
            glassBg.GradientStops.Add(new GradientStop(Color.FromArgb(220, 28, 33, 46), 0.0));
            glassBg.GradientStops.Add(new GradientStop(Color.FromArgb(235, 18, 22, 32), 1.0));

            var glassRim = new LinearGradientBrush
            {
                StartPoint = new Point(0, 0),
                EndPoint = new Point(0, 1)
            };
            glassRim.GradientStops.Add(new GradientStop(Color.FromArgb(90, 255, 255, 255), 0.0));
            glassRim.GradientStops.Add(new GradientStop(Color.FromArgb(20, 255, 255, 255), 1.0));

            var toolbarBorder = new Border
            {
                Width = 58,
                BorderBrush = glassRim,
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(22),
                Background = glassBg,
                Padding = new Thickness(5, 6, 5, 6),
                Effect = new DropShadowEffect
                {
                    BlurRadius = 24,
                    ShadowDepth = 6,
                    Opacity = 0.65,
                    Color = Color.FromRgb(0, 0, 0)
                }
            };

            var stack = new StackPanel();

            // iOS Dynamic Island Drag Handle
            var dragHandle = new Grid
            {
                Height = 30,
                Background = new SolidColorBrush(Color.FromArgb(90, 255, 255, 255)),
                Cursor = Cursors.SizeAll,
                Margin = new Thickness(1, 0, 1, 6)
            };
            dragHandle.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            dragHandle.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(16, GridUnitType.Pixel) });

            var dragPill = new Border
            {
                CornerRadius = new CornerRadius(10),
                Background = new SolidColorBrush(Color.FromArgb(70, 0, 0, 0)),
                Height = 24,
                Margin = new Thickness(1)
            };
            var dragText = new TextBlock
            {
                Text = "IO",
                Foreground = new SolidColorBrush(Color.FromRgb(255, 107, 53)),
                FontWeight = FontWeights.ExtraBold,
                FontSize = 10.5,
                VerticalAlignment = VerticalAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Center
            };
            dragPill.Child = dragText;
            Grid.SetColumn(dragPill, 0);
            dragHandle.Children.Add(dragPill);

            var btnMin = new Button
            {
                Content = "—",
                FontSize = 9,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(Color.FromArgb(160, 255, 255, 255)),
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand,
                ToolTip = "Minimize"
            };
            btnMin.Click += (s, e) => { this.WindowState = WindowState.Minimized; };
            Grid.SetColumn(btnMin, 1);
            dragHandle.Children.Add(btnMin);

            dragHandle.MouseDown += (s, e) =>
            {
                if (e.ChangedButton == MouseButton.Left) this.DragMove();
            };
            stack.Children.Add(dragHandle);

            // Tools Section (Modern Vector Icons)
            btnMouse = CreateLiquidButton(
                CreateVectorIcon("M 3,2 L 13,12 L 8.5,12.5 L 11.5,19 L 9,20 L 6,13.5 L 3,16 Z", false, Brushes.White, 16),
                "Mouse [G] - Click Through", 
                (s, e) => SelectTool("cursor"));

            btnPen = CreateLiquidButton(
                CreateVectorIcon("M 17 3 a 2.85 2.83 0 1 1 4 4 L 7.5 20.5 L 2 22 L 3.5 16.5 Z M 15 5 L 19 9", true, Brushes.White, 17),
                "Pen [1] - Freehand Drawing", 
                (s, e) => SelectTool("pen"), 
                true);

            btnHigh = CreateLiquidButton(
                CreateVectorIcon("M 14 3 L 21 10 L 16 15 L 9 8 Z M 9 8 L 4 13 L 2 18 L 7 20 L 12 15 Z M 2 22 L 8 22", true, Brushes.White, 17),
                "Highlighter [2]", 
                (s, e) => SelectTool("highlighter"));

            // Real Angled Rubber Eraser with Sleeve Band & Baseline (Matches Reference)
            btnErase = CreateLiquidButton(
                CreateVectorIcon("M 4 21.5 L 20 21.5 M 11.5 5 L 18.5 12 L 10.5 20 L 3.5 13 Z M 6.3 10.2 L 13.3 17.2", true, Brushes.White, 19),
                "Eraser [3]", 
                (s, e) => SelectTool("eraser"));

            stack.Children.Add(btnMouse);
            stack.Children.Add(btnPen);
            stack.Children.Add(btnHigh);
            stack.Children.Add(btnErase);

            stack.Children.Add(CreateDivider());

            // Circular Color Swatch Button with Subtle Apple Glow
            btnColorCircle = new Button
            {
                Width = 38,
                Height = 38,
                Margin = new Thickness(0, 3, 0, 3),
                Cursor = Cursors.Hand,
                BorderThickness = new Thickness(0),
                Background = Brushes.Transparent,
                ToolTip = "Color & Stroke Palette"
            };
            AttachScaleAnimation(btnColorCircle);

            var colorBorder = new Border
            {
                Width = 32,
                Height = 32,
                CornerRadius = new CornerRadius(16),
                Background = new SolidColorBrush(currentColor),
                BorderBrush = Brushes.White,
                BorderThickness = new Thickness(2.5),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                Effect = new DropShadowEffect
                {
                    BlurRadius = 8,
                    ShadowDepth = 2,
                    Opacity = 0.45,
                    Color = Color.FromRgb(255, 90, 40)
                }
            };
            btnColorCircle.Content = colorBorder;

            btnColorCircle.Click += (s, e) =>
            {
                ToggleFlyout(!isFlyoutOpen);
            };
            stack.Children.Add(btnColorCircle);

            stack.Children.Add(CreateDivider());

            // Board Mode (Toggle Whiteboard)
            btnBoard = CreateLiquidButton(
                CreateVectorIcon("M 3 3 L 21 3 L 21 15 L 3 15 Z M 12 15 L 12 21 M 7 21 L 17 21", true, Brushes.White, 17),
                "Whiteboard [B] (Esc to return)", 
                (s, e) => ToggleBoardMode());
            stack.Children.Add(btnBoard);

            // Undo & Clear
            stack.Children.Add(CreateLiquidButton(
                CreateVectorIcon("M 4 9 L 9 4 M 4 9 L 9 14 M 4 9 L 14 9 a 5 5 0 0 1 5 5 a 5 5 0 0 1 -5 5 L 8 19", true, Brushes.White, 16),
                "Undo [Ctrl+Z]", 
                (s, e) => UndoStroke()));

            stack.Children.Add(CreateLiquidButton(
                CreateVectorIcon("M 3 6 L 21 6 M 19 6 L 18 19 a 2 2 0 0 1 -2 2 L 8 21 a 2 2 0 0 1 -2 -2 L 5 6 M 9 6 L 9 3 a 1 1 0 0 1 1 -1 L 14 2 a 1 1 0 0 1 1 1 L 15 6 M 10 10 L 10 16 M 14 10 L 14 16", true, Brushes.White, 16),
                "Clear Screen [C]", 
                (s, e) => ClearCanvas()));

            // Exit Button (Apple Crimson Glass with Vector Close)
            var btnExit = new Button
            {
                Content = CreateVectorIcon("M 18 6 L 6 18 M 6 18 L 18 6", true, new SolidColorBrush(Color.FromRgb(255, 180, 180)), 11),
                ToolTip = "Exit InkOver",
                Background = new SolidColorBrush(Color.FromArgb(180, 160, 25, 25)),
                Width = 36,
                Height = 28,
                Margin = new Thickness(0, 6, 0, 2),
                BorderThickness = new Thickness(1),
                BorderBrush = new SolidColorBrush(Color.FromArgb(60, 255, 100, 100)),
                Cursor = Cursors.Hand
            };
            AttachScaleAnimation(btnExit);
            btnExit.Click += (s, e) =>
            {
                Environment.Exit(0);
            };
            stack.Children.Add(btnExit);

            toolbarBorder.Child = stack;
            Grid.SetColumn(toolbarBorder, 0);
            mainGrid.Children.Add(toolbarBorder);

            // ==================== COLUMN 1: MAC / IOS FROSTED GLASS FLYOUT ====================
            var flyoutBg = new LinearGradientBrush
            {
                StartPoint = new Point(0, 0),
                EndPoint = new Point(0, 1)
            };
            flyoutBg.GradientStops.Add(new GradientStop(Color.FromArgb(235, 30, 36, 50), 0.0));
            flyoutBg.GradientStops.Add(new GradientStop(Color.FromArgb(245, 18, 22, 34), 1.0));

            flyoutTranslate = new TranslateTransform(16, 0);

            flyoutCard = new Border
            {
                Width = 205,
                Margin = new Thickness(10, 0, 0, 0),
                Background = flyoutBg,
                BorderBrush = glassRim,
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(20),
                Padding = new Thickness(13),
                Opacity = 0.0,
                Visibility = Visibility.Collapsed,
                RenderTransform = flyoutTranslate,
                Effect = new DropShadowEffect
                {
                    BlurRadius = 32,
                    ShadowDepth = 8,
                    Opacity = 0.75,
                    Color = Colors.Black
                }
            };

            var contentStack = new StackPanel();

            // Header: Apple Style Section Title + Close Button
            var headerGrid = new Grid { Margin = new Thickness(0, 0, 0, 8) };
            headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(20, GridUnitType.Pixel) });

            var lblTitle = new TextBlock
            {
                Text = "INK COLOR",
                FontSize = 9.5,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(Color.FromArgb(170, 255, 255, 255)),
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(lblTitle, 0);
            headerGrid.Children.Add(lblTitle);

            var btnClose = new Button
            {
                Content = "✕",
                FontSize = 10,
                Foreground = new SolidColorBrush(Color.FromArgb(150, 255, 255, 255)),
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand,
                ToolTip = "Close"
            };
            btnClose.Click += (s, e) => { ToggleFlyout(false); };
            Grid.SetColumn(btnClose, 1);
            headerGrid.Children.Add(btnClose);
            contentStack.Children.Add(headerGrid);

            // 12 Circular Swatches (4 cols x 3 rows) with Apple Smooth Hover
            var colorGrid = new UniformGrid
            {
                Columns = 4,
                Rows = 3,
                Margin = new Thickness(0, 2, 0, 10)
            };

            popupColorBorders.Clear();
            foreach (var col in paletteColors)
            {
                bool isSelected = (col == currentColor);
                var swatchBorder = new Border
                {
                    Width = 32,
                    Height = 32,
                    CornerRadius = new CornerRadius(16),
                    Background = new SolidColorBrush(col),
                    BorderBrush = isSelected ? Brushes.White : new SolidColorBrush(Color.FromArgb(30, 255, 255, 255)),
                    BorderThickness = isSelected ? new Thickness(2.5) : new Thickness(1),
                    Margin = new Thickness(4),
                    Cursor = Cursors.Hand,
                    Effect = isSelected ? new DropShadowEffect { BlurRadius = 8, ShadowDepth = 2, Opacity = 0.5, Color = Colors.White } : null
                };

                AttachScaleAnimation(swatchBorder, 1.15);

                Color targetColor = col;
                swatchBorder.MouseDown += (s, e) =>
                {
                    SelectColor(targetColor);
                };

                popupColorBorders.Add(swatchBorder);
                colorGrid.Children.Add(swatchBorder);
            }
            contentStack.Children.Add(colorGrid);

            // Divider
            contentStack.Children.Add(new Border
            {
                Height = 1,
                Background = new SolidColorBrush(Color.FromArgb(30, 255, 255, 255)),
                Margin = new Thickness(0, 2, 0, 8)
            });

            // Section 2: Stroke Size with Frosted Pill Buttons
            var lblSize = new TextBlock
            {
                Text = "STROKE SIZE",
                FontSize = 9.5,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(Color.FromArgb(170, 255, 255, 255)),
                Margin = new Thickness(0, 0, 0, 8)
            };
            contentStack.Children.Add(lblSize);

            var sizePanel = new UniformGrid { Columns = 4, Margin = new Thickness(0, 0, 0, 10) };
            popupSizeButtons.Clear();

            for (int i = 0; i < strokeSizes.Length; i++)
            {
                double sz = strokeSizes[i];
                bool isSizeSelected = Math.Abs(sz - strokeSize) < 0.1;

                var sizeBtn = new Button
                {
                    Height = 32,
                    Width = 34,
                    Margin = new Thickness(3),
                    Background = isSizeSelected ? new SolidColorBrush(Color.FromRgb(255, 90, 40)) : new SolidColorBrush(Color.FromArgb(60, 255, 255, 255)),
                    BorderThickness = new Thickness(1),
                    BorderBrush = isSizeSelected ? new SolidColorBrush(Color.FromArgb(150, 255, 255, 255)) : new SolidColorBrush(Color.FromArgb(20, 255, 255, 255)),
                    Cursor = Cursors.Hand,
                    ToolTip = sz.ToString() + "px"
                };
                AttachScaleAnimation(sizeBtn, 1.1);

                double dotDiameter = 4 + (i * 3.5);
                var dot = new Ellipse
                {
                    Width = dotDiameter,
                    Height = dotDiameter,
                    Fill = isSizeSelected ? Brushes.White : new SolidColorBrush(Color.FromArgb(180, 255, 255, 255))
                };
                sizeBtn.Content = dot;

                double targetSize = sz;
                sizeBtn.Click += (s, e) =>
                {
                    SelectStrokeSize(targetSize);
                };

                popupSizeButtons.Add(sizeBtn);
                sizePanel.Children.Add(sizeBtn);
            }
            contentStack.Children.Add(sizePanel);

            // Section 3: Keyboard Shortcuts Legend
            contentStack.Children.Add(new Border
            {
                Height = 1,
                Background = new SolidColorBrush(Color.FromArgb(30, 255, 255, 255)),
                Margin = new Thickness(0, 2, 0, 8)
            });

            var shortcutsStack = new StackPanel();
            shortcutsStack.Children.Add(new TextBlock
            {
                Text = "QUICK SHORTCUTS",
                FontSize = 8.5,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(Color.FromArgb(120, 255, 255, 255)),
                Margin = new Thickness(0, 0, 0, 4)
            });

            string[] shortcuts = new string[]
            {
                "1 : Pen        2 : Highlighter",
                "3 : Eraser     G : Mouse / Ghost",
                "B : Whiteboard C : Clear Canvas",
                "Ctrl+Z : Undo  Esc : Exit Board"
            };

            foreach (var sc in shortcuts)
            {
                shortcutsStack.Children.Add(new TextBlock
                {
                    Text = sc,
                    FontSize = 8,
                    Foreground = new SolidColorBrush(Color.FromArgb(180, 255, 255, 255)),
                    Margin = new Thickness(0, 1.5, 0, 1.5)
                });
            }
            contentStack.Children.Add(shortcutsStack);

            flyoutCard.Child = contentStack;
            Grid.SetColumn(flyoutCard, 1);
            mainGrid.Children.Add(flyoutCard);

            this.Content = mainGrid;
        }

        private void ToggleFlyout(bool open)
        {
            isFlyoutOpen = open;
            if (open)
            {
                flyoutCard.Visibility = Visibility.Visible;

                // iOS-Style Smooth Fluid Fade & Slide Transition
                var opacityAnim = new DoubleAnimation(0.0, 1.0, TimeSpan.FromMilliseconds(220))
                {
                    EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut }
                };
                flyoutCard.BeginAnimation(UIElement.OpacityProperty, opacityAnim);

                var slideAnim = new DoubleAnimation(16.0, 0.0, TimeSpan.FromMilliseconds(220))
                {
                    EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut }
                };
                flyoutTranslate.BeginAnimation(TranslateTransform.XProperty, slideAnim);
            }
            else
            {
                var opacityAnim = new DoubleAnimation(1.0, 0.0, TimeSpan.FromMilliseconds(150))
                {
                    EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn }
                };
                opacityAnim.Completed += (s, e) =>
                {
                    if (!isFlyoutOpen) flyoutCard.Visibility = Visibility.Collapsed;
                };
                flyoutCard.BeginAnimation(UIElement.OpacityProperty, opacityAnim);

                var slideAnim = new DoubleAnimation(0.0, 12.0, TimeSpan.FromMilliseconds(150))
                {
                    EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn }
                };
                flyoutTranslate.BeginAnimation(TranslateTransform.XProperty, slideAnim);
            }
        }

        private FrameworkElement CreateVectorIcon(string pathData, bool isStroke = true, Brush customBrush = null, double size = 18)
        {
            Brush brush = customBrush != null ? customBrush : Brushes.White;
            var path = new System.Windows.Shapes.Path
            {
                Data = Geometry.Parse(pathData),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };

            if (isStroke)
            {
                path.Stroke = brush;
                path.StrokeThickness = 1.9;
                path.StrokeStartLineCap = PenLineCap.Round;
                path.StrokeEndLineCap = PenLineCap.Round;
                path.StrokeLineJoin = PenLineJoin.Round;
                path.Fill = Brushes.Transparent;
            }
            else
            {
                path.Fill = brush;
                path.Stroke = null;
            }

            var vb = new Viewbox
            {
                Width = size,
                Height = size,
                Child = path,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };
            return vb;
        }

        private Button CreateLiquidButton(object icon, string tooltip, RoutedEventHandler handler, bool active = false)
        {
            var btn = new Button
            {
                Content = icon,
                ToolTip = tooltip,
                Foreground = Brushes.White,
                Background = active ? new SolidColorBrush(Color.FromRgb(255, 90, 40)) : new SolidColorBrush(Color.FromArgb(40, 255, 255, 255)),
                FontSize = 13.5,
                Width = 38,
                Height = 38,
                Margin = new Thickness(0, 2, 0, 2),
                BorderThickness = new Thickness(1),
                BorderBrush = active ? new SolidColorBrush(Color.FromArgb(120, 255, 255, 255)) : new SolidColorBrush(Color.FromArgb(15, 255, 255, 255)),
                Cursor = Cursors.Hand
            };

            AttachScaleAnimation(btn, 1.08);
            btn.Click += handler;
            return btn;
        }

        private void AttachScaleAnimation(FrameworkElement element, double targetScale = 1.08)
        {
            var scale = new ScaleTransform(1.0, 1.0);
            element.RenderTransformOrigin = new Point(0.5, 0.5);
            element.RenderTransform = scale;

            element.MouseEnter += (s, e) =>
            {
                var anim = new DoubleAnimation(1.0, targetScale, TimeSpan.FromMilliseconds(120))
                {
                    EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
                };
                scale.BeginAnimation(ScaleTransform.ScaleXProperty, anim);
                scale.BeginAnimation(ScaleTransform.ScaleYProperty, anim);
            };

            element.MouseLeave += (s, e) =>
            {
                var anim = new DoubleAnimation(targetScale, 1.0, TimeSpan.FromMilliseconds(120))
                {
                    EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
                };
                scale.BeginAnimation(ScaleTransform.ScaleXProperty, anim);
                scale.BeginAnimation(ScaleTransform.ScaleYProperty, anim);
            };
        }

        private Border CreateDivider()
        {
            return new Border
            {
                Height = 1,
                Background = new SolidColorBrush(Color.FromArgb(30, 255, 255, 255)),
                Margin = new Thickness(6, 4, 6, 4)
            };
        }

        private void SetButtonActive(Button activeBtn)
        {
            var inactiveBrush = new SolidColorBrush(Color.FromArgb(40, 255, 255, 255));
            var activeBrush = new SolidColorBrush(Color.FromRgb(255, 90, 40));

            btnMouse.Background = (activeBtn == btnMouse) ? activeBrush : inactiveBrush;
            btnPen.Background = (activeBtn == btnPen) ? activeBrush : inactiveBrush;
            btnHigh.Background = (activeBtn == btnHigh) ? activeBrush : inactiveBrush;
            btnErase.Background = (activeBtn == btnErase) ? activeBrush : inactiveBrush;
        }

        public void SelectColor(Color newColor)
        {
            currentColor = newColor;

            Border previewBorder = btnColorCircle.Content as Border;
            if (previewBorder != null)
            {
                previewBorder.Background = new SolidColorBrush(currentColor);
                DropShadowEffect shadow = previewBorder.Effect as DropShadowEffect;
                if (shadow != null)
                {
                    shadow.Color = currentColor;
                }
            }

            for (int i = 0; i < paletteColors.Length && i < popupColorBorders.Count; i++)
            {
                bool isSelected = (paletteColors[i] == currentColor);
                popupColorBorders[i].BorderBrush = isSelected ? Brushes.White : new SolidColorBrush(Color.FromArgb(30, 255, 255, 255));
                popupColorBorders[i].BorderThickness = isSelected ? new Thickness(2.5) : new Thickness(1);
                popupColorBorders[i].Effect = isSelected ? new DropShadowEffect { BlurRadius = 8, ShadowDepth = 2, Opacity = 0.5, Color = Colors.White } : null;
            }

            if (currentTool != "pen" && currentTool != "highlighter")
            {
                SelectTool("pen");
            }
            else
            {
                SelectTool(currentTool);
            }
        }

        public void SelectStrokeSize(double newSize)
        {
            strokeSize = newSize;

            for (int i = 0; i < strokeSizes.Length && i < popupSizeButtons.Count; i++)
            {
                bool isSelected = Math.Abs(strokeSizes[i] - strokeSize) < 0.1;
                popupSizeButtons[i].Background = isSelected ? new SolidColorBrush(Color.FromRgb(255, 90, 40)) : new SolidColorBrush(Color.FromArgb(60, 255, 255, 255));
                Ellipse dot = popupSizeButtons[i].Content as Ellipse;
                if (dot != null)
                {
                    dot.Fill = isSelected ? Brushes.White : new SolidColorBrush(Color.FromArgb(180, 255, 255, 255));
                }
            }

            SelectTool(currentTool);
        }

        public void SelectTool(string tool)
        {
            currentTool = tool;
            if (tool == "cursor")
            {
                SetButtonActive(btnMouse);
                SetClickThrough(true);
            }
            else
            {
                SetClickThrough(false);
                if (tool == "pen")
                {
                    SetButtonActive(btnPen);
                    inkCanvas.EditingMode = InkCanvasEditingMode.Ink;
                    inkCanvas.DefaultDrawingAttributes.IsHighlighter = false;
                    inkCanvas.DefaultDrawingAttributes.Color = currentColor;
                    inkCanvas.DefaultDrawingAttributes.Width = strokeSize;
                    inkCanvas.DefaultDrawingAttributes.Height = strokeSize;
                    inkCanvas.Cursor = Cursors.Pen;
                }
                else if (tool == "highlighter")
                {
                    SetButtonActive(btnHigh);
                    inkCanvas.EditingMode = InkCanvasEditingMode.Ink;
                    inkCanvas.DefaultDrawingAttributes.IsHighlighter = true;
                    inkCanvas.DefaultDrawingAttributes.Color = Color.FromArgb(120, currentColor.R, currentColor.G, currentColor.B);
                    inkCanvas.DefaultDrawingAttributes.Width = strokeSize * 3.5;
                    inkCanvas.DefaultDrawingAttributes.Height = strokeSize * 3.5;
                    inkCanvas.Cursor = Cursors.Cross;
                }
                else if (tool == "eraser")
                {
                    SetButtonActive(btnErase);
                    inkCanvas.EditingMode = InkCanvasEditingMode.EraseByPoint;
                    inkCanvas.Cursor = Cursors.Hand;
                }
            }
        }

        private void SetClickThrough(bool passThrough)
        {
            if (overlayHwnd == IntPtr.Zero || overlayWindow == null) return;

            int exStyle = GetWindowLong(overlayHwnd, GWL_EXSTYLE);
            if (passThrough)
            {
                SetWindowLong(overlayHwnd, GWL_EXSTYLE, exStyle | WS_EX_TRANSPARENT);
                overlayWindow.IsHitTestVisible = false;
                inkCanvas.IsHitTestVisible = false;

                if (boardMode != "transparent")
                {
                    overlayWindow.Visibility = Visibility.Hidden;
                }
            }
            else
            {
                if (boardMode != "transparent")
                {
                    overlayWindow.Visibility = Visibility.Visible;
                }

                SetWindowLong(overlayHwnd, GWL_EXSTYLE, exStyle & ~WS_EX_TRANSPARENT);
                overlayWindow.IsHitTestVisible = true;
                inkCanvas.IsHitTestVisible = true;
                overlayWindow.Topmost = true;
                this.Topmost = true;
            }
        }

        private void ToggleBoardMode()
        {
            if (boardMode == "transparent")
            {
                boardMode = "whiteboard";
                btnBoard.Background = new SolidColorBrush(Color.FromRgb(255, 90, 40));
                overlayWindow.Background = Brushes.White;
                inkCanvas.Background = Brushes.White;
                overlayWindow.Visibility = Visibility.Visible;
                overlayWindow.Topmost = true;
                this.Topmost = true;
            }
            else
            {
                boardMode = "transparent";
                btnBoard.Background = new SolidColorBrush(Color.FromArgb(40, 255, 255, 255));
                overlayWindow.Background = hitTestBrush;
                inkCanvas.Background = hitTestBrush;
            }
        }

        private void ClearCanvas()
        {
            inkCanvas.Strokes.Clear();
        }

        private void UndoStroke()
        {
            if (inkCanvas.Strokes.Count > 0)
            {
                inkCanvas.Strokes.RemoveAt(inkCanvas.Strokes.Count - 1);
            }
        }
    }
}

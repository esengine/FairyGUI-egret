
module fairygui {

    export class GLoader extends GObject implements IAnimationGear, IColorGear {
        private _gearAnimation: GearAnimation;
        private _gearColor: GearColor;
        
        private _url: string;
        private _align: AlignType;
        private _verticalAlign: VertAlignType;
        private _autoSize: boolean;
        private _fill: FillType;
        private _showErrorSign: boolean;
        private _playing: boolean;
        private _frame: number = 0;
        private _color: number = 0;

        private _contentItem: PackageItem;
        private _contentSourceWidth: number = 0;
        private _contentSourceHeight: number = 0;
        private _contentWidth: number = 0;
        private _contentHeight: number = 0;

        private _container: UIContainer;
        private _content: egret.DisplayObject;
        private _errorSign: GObject;

        private _updatingLayout: boolean;

        private _loading: number = 0;
        private _externalLoader: egret.URLLoader;

        private static _errorSignPool: GObjectPool = new GObjectPool();

        public constructor() {
            super();
            this._playing = true;
            this._url = "";
            this._align = AlignType.Left;
            this._verticalAlign = VertAlignType.Top;
            this._showErrorSign = true;
            this._color = 0xFFFFFF;

            this._gearAnimation = new GearAnimation(this);
            this._gearColor = new GearColor(this);
        }

        protected createDisplayObject(): void {
            this._container = new UIContainer(this);
            this._container.scaleX = GRoot.contentScaleFactor;
            this._container.scaleY = GRoot.contentScaleFactor;
            this.setDisplayObject(this._container);
        }

        public dispose(): void {
            super.dispose();
        }

        public get url(): string {
            return this._url;
        }

        public set url(value: string) {
            if (this._url == value)
                return;

            this._url = value;
            this.loadContent();
        }

        public get align(): AlignType {
            return this._align;
        }

        public set align(value: AlignType) {
            if (this._align != value) {
                this._align = value;
                this.updateLayout();
            }
        }

        public get verticalAlign(): VertAlignType {
            return this._verticalAlign;
        }

        public set verticalAlign(value: VertAlignType) {
            if (this._verticalAlign != value) {
                this._verticalAlign = value;
                this.updateLayout();
            }
        }

        public get fill(): FillType {
            return this._fill;
        }

        public set fill(value: FillType) {
            if (this._fill != value) {
                this._fill = value;
                this.updateLayout();
            }
        }

        public get autoSize(): boolean {
            return this._autoSize;
        }

        public set autoSize(value: boolean) {
            if (this._autoSize != value) {
                this._autoSize = value;
                this.updateLayout();
            }
        }

        public get playing(): boolean {
            return this._playing;
        }

        public set playing(value: boolean) {
            if (this._playing != value) {
                this._playing = value;
                if (this._content instanceof egret.MovieClip)
                    (<MovieClip>(this._content)).playing = value;

                if (this._gearAnimation.controller != null)
                    this._gearAnimation.updateState();
            }
        }

        public get frame(): number {
            return this._frame;
        }

        public set frame(value: number) {
            if (this._frame != value) {
                this._frame = value;
                if (this._content instanceof egret.MovieClip)
                    (<MovieClip>(this._content)).currentFrame = value;

                if (this._gearAnimation.controller != null)
                    this._gearAnimation.updateState();
            }
        }
        
        public get color(): number {
            return this._color;
        }
        
        public set color(value: number) {
            if(this._color != value) {
                this._color = value;
                if(this._gearColor.controller != null)
                    this._gearColor.updateState();

                this.applyColor();
            }
        }
                    
        private applyColor(): void {
            //todo:
        }
            
        public get showErrorSign(): boolean {
            return this._showErrorSign;
        }

        public set showErrorSign(value: boolean) {
            this._showErrorSign = value;
        }

        protected loadContent(): void {
            this.clearContent();

            if (!this._url)
                return;

            if(ToolSet.startsWith(this._url,"ui://"))
                this.loadFromPackage(this._url);
            else
                this.loadExternal();
        }
        
        protected loadFromPackage(itemURL: string) {
            this._contentItem = UIPackage.getItemByURL(itemURL);
            if(this._contentItem != null) {
                this._contentItem.load();

                if(this._contentItem.type == PackageItemType.Image) {
                    if(this._contentItem.texture == null) {
                        this.setErrorState();
                    }
                    else {
                        if(!(this._content instanceof egret.Bitmap)) {
                            this._content = new egret.Bitmap();
                            this._container.addChild(this._content);
                        }
                        else
                            this._container.addChild(this._content);
                        (<egret.Bitmap>(this._content)).texture = this._contentItem.texture;
                        (<egret.Bitmap>(this._content)).scale9Grid = this._contentItem.scale9Grid;
                        if(this._contentItem.scaleByTile)
                            (<egret.Bitmap>(this._content)).fillMode = egret.BitmapFillMode.REPEAT;
                        else(<egret.Bitmap>(this._content)).fillMode = egret.BitmapFillMode.SCALE;
                        this._contentSourceWidth = this._contentItem.width;
                        this._contentSourceHeight = this._contentItem.height;
                        this.updateLayout();
                    }
                }
                else if(this._contentItem.type == PackageItemType.MovieClip) {
                    if(!(this._content instanceof MovieClip)) {
                        this._content = new MovieClip();
                        this._container.addChild(this._content);
                    }
                    else
                        this._container.addChild(this._content);
                    (<MovieClip>(this._content)).interval = this._contentItem.interval;
                    (<MovieClip>(this._content)).frames = this._contentItem.frames;
                    this._contentSourceWidth = this._contentItem.width;
                    this._contentSourceHeight = this._contentItem.height;
                    this.updateLayout();
                }
                else
                    this.setErrorState();
            }
            else
                this.setErrorState();
        }

        protected loadExternal(): void {
            if(!this._externalLoader) {
                this._externalLoader = new egret.URLLoader();
                this._externalLoader.dataFormat = egret.URLLoaderDataFormat.TEXTURE;
                this._externalLoader.addEventListener(egret.Event.COMPLETE,this.__externalLoadCompleted,this);
                this._externalLoader.addEventListener(egret.IOErrorEvent.IO_ERROR,this.__externalLoadFailed,this);
            }
            this._externalLoader.load(new egret.URLRequest(this.url));
            this._loading = 3;
        }

        protected onExternalLoadSuccess(texture: egret.Texture): void {
            this._loading = 0;
            if(!(this._content instanceof egret.Bitmap)) {
                this._content = new egret.Bitmap();
                this._container.addChild(this._content);
            }
            else
                this._container.addChild(this._content);
            (<egret.Bitmap>(this._content)).texture = texture;
            (<egret.Bitmap>(this._content)).scale9Grid = null;
            (<egret.Bitmap>(this._content)).fillMode = egret.BitmapFillMode.SCALE;
            this._contentSourceWidth = texture.textureWidth;
            this._contentSourceHeight = texture.textureHeight;
            this.updateLayout();
        }

        protected onExternalLoadFailed(): void {
            this.setErrorState();
        }

        private __externalLoadCompleted(evt: egret.Event): void {
            var cc: any = this._externalLoader.data;
            if (cc instanceof egret.Texture) {
                this.onExternalLoadSuccess(<egret.Texture>cc);
            }
            else
                this.onExternalLoadFailed();
        }

        private __externalLoadFailed(evt: egret.Event): void {
            this.onExternalLoadFailed();
        }

        private setErrorState(): void {
            if (!this._showErrorSign)
                return;

            if (this._errorSign == null) {
                if (UIConfig.loaderErrorSign != null) {
                    this._errorSign = GLoader._errorSignPool.getObject(UIConfig.loaderErrorSign);
                }
            }

            if (this._errorSign != null) {
                this._errorSign.width = this.width;
                this._errorSign.height = this.height;
                this._container.addChild(this._errorSign.displayObject);
            }
        }

        private clearErrorState(): void {
            if (this._errorSign != null) {
                this._container.removeChild(this._errorSign.displayObject);
                GLoader._errorSignPool.returnObject(this._errorSign);
                this._errorSign = null;
            }
        }

        private updateLayout(): void {
            if (this._content == null) {
                if (this._autoSize) {
                    this._updatingLayout = true;
                    this.setSize(50, 30);
                    this._updatingLayout = false;
                }
                return;
            }

            this._content.x = 0;
            this._content.y = 0;
            this._content.scaleX = 1;
            this._content.scaleY = 1;
            this._contentWidth = this._contentSourceWidth;
            this._contentHeight = this._contentSourceHeight;

            if (this._autoSize) {
                this._updatingLayout = true;
                if (this._contentWidth == 0)
                    this._contentWidth = 50;
                if (this._contentHeight == 0)
                    this._contentHeight = 30;
                this.setSize(this._contentWidth, this._contentHeight);
                this._updatingLayout = false;
            }
            else {
                var sx: number = 1, sy: number = 1;
                if (this._fill == FillType.Scale || this._fill == FillType.ScaleFree) {
                    sx = this.width / this._contentSourceWidth;
                    sy = this.height / this._contentSourceHeight;

                    if (sx != 1 || sy != 1) {
                        if (this._fill == FillType.Scale) {
                            if (sx > sy)
                                sx = sy;
                            else
                                sy = sx;
                        }
                        this._contentWidth = this._contentSourceWidth * sx;
                        this._contentHeight = this._contentSourceHeight * sy;
                    }
                }

                if (this._content instanceof egret.Bitmap) {
                    this._content.width = this._contentWidth;
                    this._content.height = this._contentHeight;
                }
                else {
                    this._content.scaleX = sx;
                    this._content.scaleY = sy;
                }

                if (this._align == AlignType.Center)
                    this._content.x = Math.floor((this.width - this._contentWidth) / 2);
                else if (this._align == AlignType.Right)
                    this._content.x = this.width - this._contentWidth;
                if (this._verticalAlign == VertAlignType.Middle)
                    this._content.y = Math.floor((this.height - this._contentHeight) / 2);
                else if (this._verticalAlign == VertAlignType.Bottom)
                    this._content.y = this.height - this._contentHeight;
            }
        }

        private clearContent(): void {
            this.clearErrorState();

            if (this._content != null && this._content.parent != null)
                this._container.removeChild(this._content);

            this._contentItem = null;
            this._loading = 0;
        }
        
        public get gearAnimation(): GearAnimation {
            return this._gearAnimation;
        }
                            
        public get gearColor(): GearColor {
            return this._gearColor;
        }
        
        public handleControllerChanged(c: Controller): void {
            super.handleControllerChanged(c);
            if(this._gearAnimation.controller == c)
                this._gearAnimation.apply();
            if(this._gearColor.controller == c)
                this._gearColor.apply();
        }

        protected handleSizeChanged(): void {
            if(!this._updatingLayout)
                this.updateLayout();

            this._container.scaleX = this.scaleX * GRoot.contentScaleFactor;
            this._container.scaleY = this.scaleY * GRoot.contentScaleFactor;
        }

        public setup_beforeAdd(xml: any): void {
            super.setup_beforeAdd(xml);

            var str: string;
            str = xml.$url;
            if (str)
                this._url = str;

            str = xml.$align;
            if (str)
                this._align = parseAlignType(str);

            str = xml.$vAlign;
            if (str)
                this._verticalAlign = parseVertAlignType(str);

            str = xml.$fill;
            if (str)
                this._fill = parseFillType(str);

            this._autoSize = xml.$autoSize == "true";

            str = xml.$errorSign;
            if (str)
                this._showErrorSign = str == "true";

            this._playing = xml.$playing != "false";

            str = xml.$color;
            if(str)
                this.color = ToolSet.convertFromHtmlColor(str);
                        
            if (this._url)
                this.loadContent();
        }
        
        public setup_afterAdd(xml: any): void {
            super.setup_afterAdd(xml);

            var col: any = xml.children;
            if(col) {
                var length1: number = col.length;
                for(var i1: number = 0;i1 < length1;i1++) {
                    var cxml: any = col[i1];
                    if(cxml.name == "gearAni") {
                        this._gearAnimation.setup(cxml);
                        break;
                    }
                    else if(cxml.name == "gearColor") {
                        this._gearColor.setup(cxml);
                        break;
                    }
                }
            }
        }
    }
}
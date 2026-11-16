package main
import (
 "fmt"
 "io"
 "strings"
 "github.com/kkdai/youtube/v2"
)
func main(){
 id:="aqz-KE-bpKQ"
 r:=struct{Engine string `json:"engine"`;VideoID string `json:"videoId"`;Playable bool `json:"verifiedMedia"`;Formats int `json:"formats"`;Bytes int `json:"bytes"`;Message string `json:"message"`}{Engine:"kkdai/youtube Go v2",VideoID:id}
 client:=youtube.Client{}
 video,err:=client.GetVideo(id)
 if err!=nil{r.Message=err.Error();fmt.Println("GO_ENGINE_SHOWDOWN",r);return}
 formats:=video.Formats.WithAudioChannels()
 r.Formats=len(formats)
 if len(formats)==0{r.Message="No downloadable video formats";fmt.Println("GO_ENGINE_SHOWDOWN",r);return}
 stream,_,err:=client.GetStream(video,&formats[0])
 if err!=nil{r.Message=err.Error();fmt.Println("GO_ENGINE_SHOWDOWN",r);return}
 defer stream.Close()
 bytes:=make([]byte,32768)
 n,err:=io.ReadAtLeast(stream,bytes,12)
 r.Bytes=n
 if err!=nil{r.Message=err.Error()}
 mp4:=n>=8&&string(bytes[4:8])=="ftyp"
 webm:=n>=4&&bytes[0]==0x1a&&bytes[1]==0x45&&bytes[2]==0xdf&&bytes[3]==0xa3
 r.Playable=mp4||webm
 if r.Playable{r.Message="Actual file signature verified"}else if r.Message==""{r.Message="Received no recognized video signature"}
 r.Message=strings.ReplaceAll(r.Message,"https://","[url]")
 fmt.Println("GO_ENGINE_SHOWDOWN",r)
}
